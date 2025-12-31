# Complete Phase 2 & 3 Integration for main_window.py

# This file contains all the code additions needed

# ========== IMPORTS TO ADD (after existing imports) ==========

from .advanced_tools import QualityReportWindow, ConflictReportWindow, AuditLogViewerWindow

# ========== IN create_menu() - ADD TO TOOLS MENU (after line 94) ==========

tools_menu.add_separator()
tools_menu.add_command(label="Quality Report", command=self.show_quality_report)
tools_menu.add_command(label="Check Conflicts", command=self.check_error_conflicts)
tools_menu.add_command(label="View Audit Log", command=self.view_audit_log)

# ========== IN setup_data_tab() - ADD AFTER controls_frame (around line 113) ==========

# Live Search Bar

ttk.Label(controls_frame, text="Search:").pack(side=tk.LEFT, padx=(20, 5))
self.search_var = tk.StringVar()
self.search_var.trace('w', self.on_search_changed)
search_entry = ttk.Entry(controls_frame, textvariable=self.search_var, width=25)
search_entry.pack(side=tk.LEFT, padx=5)

# ========== IN setup_data_tab() - ADD QUICK EDIT PANEL (after diff_view setup, around line 140) ==========

# Quick Edit Panel

edit_panel_frame = ttk.LabelFrame(self.data_tab, text="Quick Edit")
edit_panel_frame.pack(fill=tk.X, pady=5)

quick_edit_inner = ttk.Frame(edit_panel_frame)
quick_edit_inner.pack(fill=tk.X, padx=10, pady=5)

ttk.Label(quick_edit_inner, text="Selected:").grid(row=0, column=0, sticky="w", padx=5)
self.quick_edit_original = tk.StringVar()
ttk.Entry(quick_edit_inner, textvariable=self.quick_edit_original, state="readonly", width=30).grid(row=0, column=1, padx=5)

ttk.Label(quick_edit_inner, text="Correction:").grid(row=1, column=0, sticky="w", padx=5, pady=5)
self.quick_edit_correction = tk.StringVar()
ttk.Entry(quick_edit_inner, textvariable=self.quick_edit_correction, width=30).grid(row=1, column=1, padx=5, pady=5)

ttk.Button(quick_edit_inner, text="Add to Error Map", command=self.quick_add_error_map).grid(row=1, column=2, padx=5)
ttk.Button(quick_edit_inner, text="Add as Standard", command=self.quick_add_standard).grid(row=1, column=3, padx=5)

# ========== IN setup_data_tab() - BIND DOUBLE-CLICK (after right-click binding, around line 125) ==========

self.tree.bind("<Double-1>", self.on_tree_double_click)

# ========== NEW METHODS TO ADD AT END OF MainWindow CLASS ==========

# Phase 2 & 3 Methods

def show_quality_report(self):
\"\"\"Generate and display quality report\"\"\"
quality_data = self.processor.generate_quality_report()
QualityReportWindow(self.root, quality_data)

def check_error_conflicts(self):
\"\"\"Check and display error map conflicts\"\"\"
conflicts = self.processor.check_conflicts()
ConflictReportWindow(self.root, conflicts)

def view_audit_log(self):
\"\"\"Open audit log viewer\"\"\"
AuditLogViewerWindow(self.root, self.db)

def on_search_changed(self, \*args):
\"\"\"Handle live search with debouncing\"\"\" # Cancel previous search timer
if hasattr(self, '\_search_timer'):
self.root.after_cancel(self.\_search_timer)

    # Schedule new search after 300ms
    self._search_timer = self.root.after(300, self.perform_search)

def perform_search(self):
\"\"\"Perform the actual search\"\"\"
search_term = self.search_var.get().upper()
filters = {}

    # Apply status filter
    filter_status = self.status_filter_var.get()
    if filter_status != "All":
        filters["status"] = filter_status

    # Apply search filter
    if search_term:
        filters["search"] = search_term

    # Reload with filters
    self.refresh_ui_with_filters(filters)

def refresh_ui_with_filters(self, filters):
\"\"\"Refresh UI with filters applied\"\"\"
for item in self.tree.get_children():
self.tree.delete(item)

    data = self.db.get_processed_data(limit=1000, filters=filters)
    for row in data:
        row_id, file, original, suggested, score, status, final = row
        tags = []
        if status == "Auto-Matched": tags.append('auto_status')
        elif status == "Possible Match": tags.append('possible_status')
        elif status == "Did Not Match": tags.append('dnm_status')

        self.tree.insert("", "end", iid=row_id, values=(file, original, suggested, score, status, final), tags=tags)

    self.dashboard.update_dashboard()

def on_tree_double_click(self, event):
\"\"\"Handle double-click for cell editing\"\"\"
region = self.tree.identify_region(event.x, event.y)
if region != "cell":
return

    column = self.tree.identify_column(event.x)
    row_id = self.tree.identify_row(event.y)

    if not row_id or column not in ('#3', '#6'):  # Suggested or Final columns
        return

    # Get current value
    values = list(self.tree.item(row_id, "values"))
    col_idx = 2 if column == '#3' else 5
    current_value = values[col_idx]

    # Create editing entry
    bbox = self.tree.bbox(row_id, column)
    if not bbox:
        return

    entry = ttk.Entry(self.tree)
    entry.insert(0, current_value)
    entry.select_range(0, tk.END)
    entry.focus()

    entry.place(x=bbox[0], y=bbox[1], width=bbox[2], height=bbox[3])

    def save_edit(event=None):
        new_value = entry.get()
        values[col_idx] = new_value
        self.tree.item(row_id, values=values)

        # Update database
        field = "suggested" if col_idx == 2 else "final"
        self.db.update_record(row_id, {field: new_value})
        self.push_to_undo('edit', row_id, field, current_value, new_value)

        entry.destroy()

    def cancel_edit(event=None):
        entry.destroy()

    entry.bind("<Return>", save_edit)
    entry.bind("<FocusOut>", save_edit)
    entry.bind("<Escape>", cancel_edit)

def quick_add_error_map(self):
\"\"\"Quickly add selected item to error map\"\"\"
correction = self.quick_edit_correction.get().strip()
original = self.quick_edit_original.get().strip()

    if not correction or not original:
        messagebox.showwarning("Input Required", "Please select a row and enter a correction.")
        return

    self.processor.error_map[original.upper()] = correction.upper()
    self.processor.save_error_map(self.processor.error_map)
    self.quick_edit_correction.set("")
    messagebox.showinfo("Success", "Added to error map. Reprocess to apply.")

def quick_add_standard(self):
\"\"\"Quickly add correction as standard term\"\"\"
correction = self.quick_edit_correction.get().strip().upper()

    if not correction:
        messagebox.showwarning("Input Required", "Please enter a correction first.")
        return

    if correction not in self.processor.standard_terms:
        self.processor.standard_terms.append(correction)
        self.processor.save_standards(self.processor.standard_terms)
        self.quick_edit_correction.set("")
        messagebox.showinfo("Success", "Added as standard term. Reprocess to apply.")
