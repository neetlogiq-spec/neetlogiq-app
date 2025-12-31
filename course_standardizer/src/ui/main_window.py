import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
import sv_ttk
import threading
from rapidfuzz import process, fuzz

from ..core.database import DatabaseManager
from ..core.processor import DataProcessor
from ..utils.config import ConfigManager
from ..utils.logger import setup_logger
from .dashboard import Dashboard
from .dialogs import FindReplaceWindow, LearningSuggestionDialog
from .managers import StandardsManagerWindow, ErrorsManagerWindow
from .advanced_tools import ValidationWindow, AIAssistWindow, FeedbackWindow, DiffViewWidget, QualityReportWindow, ConflictReportWindow, AuditLogViewerWindow
from .batch_dialog import BatchProcessDialog
from ..core.learning import LearningManager

# Modern Components
from .modern_components.sidebar import Sidebar
from .modern_components.toast import ToastManager
from .modern_components.command_palette import CommandPalette
from .modern_components.widgets import ContextActionBar

# Undo/Redo
from ..core.commands import EditCommand, BulkUpdateCommand
from ..core.history import CommandHistory

# Agentic Normalizer
from ..core.agentic_normalizer import AgenticNormalizer

class MainWindow:
    def __init__(self, root):
        self.root = root
        self.root.title("Course Standardizer Workbench v8.0 (Modern)")
        self.root.geometry("1400x900")

        # Initialize Utils
        self.config = ConfigManager()
        self.logger = setup_logger()
        
        # Initialize Toast Manager
        self.toast = ToastManager(self.root)

        # Initialize Core
        self.db = DatabaseManager()
        self.processor = DataProcessor(self.config, self.db, self.logger)
        self.learning_manager = LearningManager(self.config, self.db, self.logger)
        self.history = CommandHistory() # Undo/Redo Manager

        # UI State
        self.sort_column = "file"
        self.sort_reverse = False
        self.nlp = self.load_spacy_model()
        self.edit_count = 0  # Track edits for learning
        self.current_view = None
        self.views = {}

        self.setup_ui()
        self.apply_theme()
        self.setup_bindings()

    def apply_theme(self):
        sv_ttk.set_theme(self.config.get("theme", "light"))

    def setup_ui(self):
        # Menu (kept for fallback/standard actions)
        self.create_menu()

        # Main Container (Horizontal Layout)
        main_container = ttk.Frame(self.root)
        main_container.pack(fill=tk.BOTH, expand=True)
        
        # Sidebar (Left)
        self.sidebar = Sidebar(main_container, self.switch_view)
        self.sidebar.pack(side=tk.LEFT, fill=tk.Y)
        
        # Content Area (Right)
        self.content_area = ttk.Frame(main_container, padding=10)
        self.content_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Initialize Views
        self.views["data"] = ttk.Frame(self.content_area)
        self.views["dashboard"] = ttk.Frame(self.content_area)
        self.views["tools"] = ttk.Frame(self.content_area)
        self.views["settings"] = ttk.Frame(self.content_area)
        
        # Setup Data View
        self.data_tab = self.views["data"] # Alias for existing code
        self.setup_data_tab()
        
        # Setup Dashboard View
        self.dashboard_tab = self.views["dashboard"] # Alias
        self.dashboard = Dashboard(self.dashboard_tab, self.db)
        self.dashboard.pack(fill=tk.BOTH, expand=True)
        
        # Setup Tools View (Placeholder)
        ttk.Label(self.views["tools"], text="Tools & Utilities", font=("Segoe UI", 20)).pack(pady=20)
        tools_frame = ttk.Frame(self.views["tools"])
        tools_frame.pack(fill=tk.X, padx=20)
        ttk.Button(tools_frame, text="🤖 Agentic Normalizer", command=self.run_agentic_normalizer).pack(fill=tk.X, pady=5)
        ttk.Button(tools_frame, text="📋 Review Queue", command=self.show_review_queue).pack(fill=tk.X, pady=5)
        ttk.Button(tools_frame, text="📤 Export Corrections", command=self.export_learned_corrections).pack(fill=tk.X, pady=5)
        ttk.Button(tools_frame, text="Validate Rules", command=self.validate_rules).pack(fill=tk.X, pady=5)
        ttk.Button(tools_frame, text="AI Assist", command=self.run_ai_assist).pack(fill=tk.X, pady=5)
        
        # Setup Settings View (Placeholder)
        ttk.Label(self.views["settings"], text="Settings", font=("Segoe UI", 20)).pack(pady=20)
        
        # Default View
        self.switch_view("data")
        
    def switch_view(self, view_name):
        # Hide current
        if self.current_view:
            self.views[self.current_view].pack_forget()
            
        # Show new
        self.views[view_name].pack(fill=tk.BOTH, expand=True)
        self.current_view = view_name
        
        # Refresh if needed
        if view_name == "dashboard":
            self.dashboard.update_dashboard()
            
    def setup_bindings(self):
        self.root.bind("<Control-k>", self.show_command_palette)
        self.root.bind("<Command-k>", self.show_command_palette)
        
    def show_command_palette(self, event=None):
        commands = {
            "Load Files": self.load_files,
            "Export Files": self.export_files,
            "Batch Process": self.batch_process_files,
            "Save Session": self.save_session,
            "Find and Replace": self.open_find_replace,
            "Manage Standards": self.manage_standards,
            "Manage Errors": self.manage_errors,
            "Validate Rules": self.validate_rules,
            "Toggle Theme": lambda: sv_ttk.toggle_theme(),
            "Exit": self.root.quit
        }
        CommandPalette(self.root, commands)

    def create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Load File(s)...", command=self.load_files)
        file_menu.add_command(label="Batch Process Files...", command=self.batch_process_files)
        file_menu.add_separator()
        file_menu.add_command(label="Save Session...", command=self.save_session)
        file_menu.add_command(label="Load Session...", command=self.load_session)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.root.quit)

        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Edit", menu=edit_menu)
        edit_menu.add_command(label="Undo", command=self.undo, accelerator="Ctrl+Z")
        edit_menu.add_command(label="Redo", command=self.redo, accelerator="Ctrl+Y")
        edit_menu.add_separator()
        edit_menu.add_command(label="Find and Replace...", command=self.open_find_replace)

        manage_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Manage", menu=manage_menu)
        manage_menu.add_command(label="Standard Courses...", command=self.manage_standards)
        manage_menu.add_command(label="Error Map...", command=self.manage_errors)

        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Tools", menu=tools_menu)
        tools_menu.add_command(label="🤖 Agentic Normalizer", command=self.run_agentic_normalizer)
        tools_menu.add_separator()
        tools_menu.add_command(label="Validate Rules", command=self.validate_rules)
        tools_menu.add_command(label="Collect Feedback", command=self.collect_feedback)
        tools_menu.add_command(label="AI Assist", command=self.run_ai_assist)
        tools_menu.add_separator()
        tools_menu.add_command(label="Quality Report", command=self.show_quality_report)
        tools_menu.add_command(label="Check Conflicts", command=self.check_error_conflicts)
        tools_menu.add_command(label="View Audit Log", command=self.view_audit_log)

    def setup_data_tab(self):
        # Controls
        controls_frame = ttk.Frame(self.data_tab)
        controls_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(controls_frame, text="Reprocess Data", command=self.reprocess_data).pack(side=tk.LEFT, padx=5)
        ttk.Button(controls_frame, text="Export Files", command=self.export_files).pack(side=tk.LEFT, padx=5)
        ttk.Button(controls_frame, text="Bulk Apply Possible", command=self.bulk_apply_possible).pack(side=tk.LEFT, padx=5)
        
        # Search bar
        search_frame = ttk.Frame(controls_frame)
        search_frame.pack(side=tk.LEFT, padx=5)
        ttk.Label(search_frame, text="Search:").pack(side=tk.LEFT)
        self.search_var = tk.StringVar()
        self.search_var.trace('w', lambda *args: self.on_search_changed())
        search_entry = ttk.Entry(search_frame, textvariable=self.search_var, width=30)
        search_entry.pack(side=tk.LEFT, padx=5)
        self._search_timer = None
        
        # Status label (for loading indicator)
        self.status_label = ttk.Label(controls_frame, text="Ready", foreground="#666")
        self.status_label.pack(side=tk.RIGHT, padx=10)
        
        # Status filter
        ttk.Label(controls_frame, text="Filter:").pack(side=tk.LEFT, padx=(20, 5))
        self.status_filter_var = tk.StringVar(value="All")
        status_filter = ttk.Combobox(controls_frame, textvariable=self.status_filter_var,
                                    values=["All", "Auto-Matched", "Possible Match", "Did Not Match"],
                                    state="readonly", width=15)
        status_filter.pack(side=tk.LEFT, padx=5)
        status_filter.bind("<<ComboboxSelected>>", lambda e: self.refresh_ui())
        
        self.progress = ttk.Progressbar(self.data_tab, mode="determinate")
        self.progress.pack(fill=tk.X, pady=5)

        # Treeview
        columns = ("File", "Original", "Suggested", "Score", "Status", "Final")
        self.tree = ttk.Treeview(self.data_tab, columns=columns, show="headings")
        
        for col in columns:
            self.tree.heading(col, text=col, command=lambda c=col: self.sort_tree(c))
            self.tree.column(col, width=150)
            
        self.tree.pack(fill=tk.BOTH, expand=True)
        
        # Bind selection event and context menu
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)
        self.tree.bind("<Button-3>", self.show_context_menu)  # Right-click
        self.tree.bind("<Double-1>", self.on_tree_double_click)  # Double-click for editing
        
        # Context Action Bar (Floating)
        self.context_bar = None
        self.tree.bind("<<TreeviewSelect>>", self.update_context_bar, add="+")
        
        # Tags
        self.tree.tag_configure('auto_status', background='#c8e6c9')
        self.tree.tag_configure('possible_status', background='#fff9c4')
        self.tree.tag_configure('dnm_status', background='#ffcdd2')
        
        # Diff View
        diff_frame = ttk.LabelFrame(self.data_tab, text="Difference View")
        diff_frame.pack(fill=tk.X, pady=5)
        self.diff_view = DiffViewWidget(diff_frame)
        self.diff_view.pack(fill=tk.BOTH, expand=True)
        
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

    def load_files(self):
        files = filedialog.askopenfilenames(filetypes=[('Data files', '*.xlsx *.xls *.csv')])
        if not files: return
        
        self.progress['value'] = 0
        self.progress['maximum'] = len(files)
        
        def _load():
            loaded_any = False
            for i, f in enumerate(files):
                try:
                    table_name, col_name, _ = self.db.load_file(f)
                    
                    # Get row count for verification
                    count = self.db.get_cursor().execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    
                    self.root.after(0, lambda: self.toast.show(
                        f"Loaded: {col_name} ({count} rows)", "success"
                    ))
                    loaded_any = True
                except Exception as e:
                    self.logger.error(f"Error loading {f}: {e}")
                    import traceback
                    traceback.print_exc()
                    self.root.after(0, lambda: self.toast.show(f"Error: {str(e)}", "error"))
                self.root.after(0, lambda v=i+1: self.progress.configure(value=v))
            
            self.root.after(0, self.reprocess_data)

        threading.Thread(target=_load).start()

    def reprocess_data(self):
        self.progress.configure(mode="indeterminate")
        self.progress.start()
        
        def on_progress(count):
            pass # Could update a label here

        def on_complete(success, message):
            self.root.after(0, self.progress.stop)
            self.root.after(0, lambda: self.refresh_ui(message))

        self.processor.process_data_async(on_progress, on_complete)

    def refresh_ui(self, message=None):
        # Show loading indicator
        if hasattr(self, 'status_label'):
            self.status_label.config(text="Loading...", foreground="#2196F3")
            self.root.update_idletasks()
        
        # Clear tree (optimized - bulk delete instead of one-by-one)
        children = self.tree.get_children()
        if children:
            self.tree.delete(*children)
            
        # Apply status filter
        filter_status = self.status_filter_var.get()
        filters = {}
        if filter_status != "All":
            filters["status"] = filter_status
            
        # Load data
        data = self.db.get_processed_data(limit=1000, filters=filters)
        
        for row in data:
            row_id, file, original, suggested, score, status, final = row
            tags = []
            if status == "Auto-Matched": tags.append('auto_status')
            elif status == "Possible Match": tags.append('possible_status')
            elif status == "Did Not Match": tags.append('dnm_status')
            
            self.tree.insert("", "end", iid=row_id, values=(file, original, suggested, score, status, final), tags=tags)
            
        self.dashboard.update_dashboard()
        
        if hasattr(self, 'status_label'):
            self.status_label.config(text=f"Ready ({len(data)} records)", foreground="#666")
        
        # Show specific message if provided (e.g. from completion callback)
        if message:
            msg_type = "error" if "Error" in str(message) or "0 records" in str(message) else "success"
            self.toast.show(str(message), msg_type)
        else:
            self.toast.show("Processing Complete", "success")

    def open_find_replace(self):
        FindReplaceWindow(self.root, self.tree, self.db, lambda: self.refresh_ui())

    def sort_tree(self, col):
        # Basic sorting logic for treeview items currently loaded
        # For full dataset sorting, we'd need to query DB with ORDER BY
        pass

    def export_files(self):
        """Export files with all corrections applied"""
        import os
        import pandas as pd
        
        # Get output folder
        output_folder = filedialog.askdirectory(title="Select Output Folder")
        if not output_folder:
            return
        
        # Get correction map (original -> final)
        correction_map = dict(self.db.cursor.execute(
            "SELECT original, final FROM processed_courses WHERE final != ''"
        ).fetchall())
        
        if not correction_map:
            messagebox.showinfo("No Corrections", "No corrections found to export.")
            return
        
        try:
            # Get list of files to export
            # We need to know which table holds the data for each file
            self.db.cursor.execute("SELECT table_name, filename, course_column FROM processed_files")
            files_to_export = self.db.cursor.fetchall()
            
            if not files_to_export:
                self.toast.show("No files to export", "warning")
                return
        except Exception as e:
            self.logger.error(f"Failed to retrieve file metadata for export: {e}")
            messagebox.showerror("Export Error", f"Failed to retrieve file information:\n{e}")
            return
        
        self.progress['maximum'] = len(files_to_export)
        exported_count = 0
        
        for i, (table_name, filename, course_col) in enumerate(files_to_export):
            try:
                # Load original data
                df = pd.read_sql_query(f"SELECT * FROM {table_name}", self.db.conn)
                
                # Apply corrections
                def apply_final(val):
                    if pd.isna(val):
                        return val
                    # Preprocess and look up in correction map
                    key = self.processor.apply_corrections(
                        self.processor.preprocess_string(str(val))
                    )
                    return correction_map.get(key, val)
                
                # Apply to course column
                if course_col and course_col in df.columns:
                    df[course_col] = df[course_col].apply(apply_final)
                
                # Determine output path and format
                base, ext = os.path.splitext(filename)
                output_path = os.path.join(output_folder, f"{base}_CLEANED{ext}")
                
                # Export
                if ext.lower() == '.csv':
                    df.to_csv(output_path, index=False)
                else:
                    df.to_excel(output_path, index=False)
                
                exported_count += 1
                self.progress['value'] = i + 1
                    
            except Exception as e:
                self.logger.error(f"Export failed for {filename}: {e}")
                messagebox.showerror("Export Error", f"Failed to export {filename}:\n{e}")
        
        self.progress['value'] = 0
        self.toast.show(f"Exported {exported_count} cleaned files!", "success")

    def manage_standards(self):
        StandardsManagerWindow(self.root, self.processor)

    def manage_errors(self):
        ErrorsManagerWindow(self.root, self.processor)

    def undo(self, event=None):
        command = self.history.undo()
        if command:
            self.toast.show(f"Undid: {command.description()}", "info")
        else:
            self.toast.show("Nothing to undo", "info")

    def redo(self, event=None):
        command = self.history.redo()
        if command:
            self.toast.show(f"Redid: {command.description()}", "info")
        else:
            self.toast.show("Nothing to redo", "info")

    def update_context_bar(self, event=None):
        """Show/Hide floating context bar based on selection"""
        selection = self.tree.selection()
        
        # Remove existing bar if any
        if self.context_bar:
            self.context_bar.destroy()
            self.context_bar = None
            
        if not selection:
            return
            
        # Create actions based on selection count
        actions = []
        if len(selection) == 1:
            actions.append(("Edit", self.on_tree_double_click, "✏️"))
            actions.append(("AI Assist", self.run_ai_assist, "🤖"))
            
        actions.append(("Approve", lambda: self.bulk_action("approve"), "✅"))
        actions.append(("Reject", lambda: self.bulk_action("reject"), "❌"))
        
        # Show bar
        self.context_bar = ContextActionBar(self.tree, actions)
        
    def bulk_action(self, action_type):
        """Perform bulk approve/reject on selected rows"""
        selection = self.tree.selection()
        if not selection:
            return
            
        updates = []
        for row_id in selection:
            # Get current values
            values = self.tree.item(row_id, "values")
            # row_id, file, original, suggested, score, status, final
            original = values[1]
            suggested = values[2]
            current_final = values[5]
            
            new_value = suggested if action_type == "approve" else original
            
            # Only update if changed
            if new_value != current_final:
                updates.append((row_id, current_final, new_value))
        
        if updates:
            command = BulkUpdateCommand(self.db, self.tree, updates, action_type.capitalize())
            self.history.push(command)
            self.toast.show(f"Bulk {action_type} applied to {len(updates)} items", "success")
            
            # Refresh context bar
            self.update_context_bar()
        else:
            self.toast.show("No changes needed", "info")

    def on_tree_select(self, event=None):
        """Handle tree selection to update diff view and quick edit"""
        if not self.tree.selection():
            self.diff_view.clear()
            self.quick_edit_original.set("")
            return
        
        values = self.tree.item(self.tree.selection()[0], "values")
        if len(values) >= 6:
            original = values[1]  # Original
            final = values[5] if values[5] else values[2]  # Final or Suggested
            self.diff_view.show_diff(original, final)
            self.quick_edit_original.set(original)

    def load_spacy_model(self):
        """Load spacy model for AI assist"""
        try:
            import spacy
            return spacy.load("en_core_web_sm")
        except Exception as e:
            self.logger.warning(f"Spacy model not loaded: {e}")
            return None

    def validate_rules(self):
        """Validate standardization rules"""
        test_cases = [
            ("MBBS", "MBBS"),
            ("MD IN GENERAL MEDICINE", "MD IN GENERAL MEDICINE"),
            ("M.D. GENERAL MEDICINE", "MD IN GENERAL MEDICINE"),
        ]
        
        results = []
        for original, expected in test_cases:
            processed = self.processor.preprocess_string(original)
            corrected = self.processor.apply_corrections(processed)
            match, score, _ = process.extractOne(corrected, self.processor.standard_terms, scorer=fuzz.WRatio) if self.processor.standard_terms else (None, 0, None)
            passed = match == expected and score >= self.config.get("auto_threshold", 90)
            results.append((original, expected, match, score, passed))
        
        ValidationWindow(self.root, results)

    def collect_feedback(self):
        """Collect user feedback on uncertain matches"""
        uncertain_threshold = 75
        uncertain = self.db.cursor.execute("""
            SELECT id, original, suggested, score 
            FROM processed_courses 
            WHERE score BETWEEN ? AND ? 
            AND final = ''
            LIMIT 10
        """, (self.config.get("possible_threshold", 70), uncertain_threshold)).fetchall()
        
        if not uncertain:
            messagebox.showinfo("No Uncertain Matches", "All matches are confident")
            return
        
        FeedbackWindow(self.root, uncertain, self.processor, self.db)

    def run_agentic_normalizer(self):
        """Run AI-powered course normalization on all loaded data."""
        # Get all items from tree
        items = self.tree.get_children()
        if not items:
            self.toast.show("No Data", "Please load data first.", "warning")
            return
        
        # Extract original course names and their tree IDs
        course_data = []
        for item_id in items:
            values = self.tree.item(item_id, "values")
            if len(values) >= 2:
                original = values[1]  # Original course column
                course_data.append((item_id, original))
        
        if not course_data:
            self.toast.show("No Courses", "No course names found in data.", "warning")
            return
        
        # Show mode selection dialog
        mode_dialog = tk.Toplevel(self.root)
        mode_dialog.title("Agentic Normalizer - Select Mode")
        mode_dialog.geometry("400x280")
        mode_dialog.transient(self.root)
        mode_dialog.grab_set()
        
        # Center the dialog
        mode_dialog.update_idletasks()
        x = self.root.winfo_x() + (self.root.winfo_width() - 400) // 2
        y = self.root.winfo_y() + (self.root.winfo_height() - 280) // 2
        mode_dialog.geometry(f"+{x}+{y}")
        
        # Title
        ttk.Label(mode_dialog, text="🤖 Agentic Course Normalizer", font=("Segoe UI", 14, "bold")).pack(pady=(15, 5))
        ttk.Label(mode_dialog, text=f"Processing {len(course_data)} courses", foreground="#666").pack()
        
        # Mode selection
        mode_var = tk.StringVar(value="single")
        
        modes_frame = ttk.LabelFrame(mode_dialog, text="Select Mode", padding=10)
        modes_frame.pack(fill=tk.X, padx=20, pady=15)
        
        # Single Model option
        single_frame = ttk.Frame(modes_frame)
        single_frame.pack(fill=tk.X, pady=5)
        ttk.Radiobutton(single_frame, text="Single Model (Fast)", variable=mode_var, value="single").pack(anchor=tk.W)
        ttk.Label(single_frame, text="Uses one LLM model. Fast with caching.", foreground="#888", font=("Segoe UI", 9)).pack(anchor=tk.W, padx=20)
        
        # Council option
        council_frame = ttk.Frame(modes_frame)
        council_frame.pack(fill=tk.X, pady=5)
        ttk.Radiobutton(council_frame, text="Council of Models (Accurate)", variable=mode_var, value="council").pack(anchor=tk.W)
        ttk.Label(council_frame, text="3 models vote in parallel. Higher accuracy.", foreground="#888", font=("Segoe UI", 9)).pack(anchor=tk.W, padx=20)
        
        # Result variable
        selected_mode = [None]
        
        def on_start():
            selected_mode[0] = mode_var.get()
            mode_dialog.destroy()
        
        def on_cancel():
            mode_dialog.destroy()
        
        # Buttons
        btn_frame = ttk.Frame(mode_dialog)
        btn_frame.pack(pady=15)
        ttk.Button(btn_frame, text="Start", command=on_start, style="Accent.TButton").pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Cancel", command=on_cancel).pack(side=tk.LEFT, padx=5)
        
        # Wait for dialog
        self.root.wait_window(mode_dialog)
        
        if not selected_mode[0]:
            return  # Cancelled
        
        use_council = selected_mode[0] == "council"
        mode_name = "Council of Models" if use_council else "Single Model"
        
        self.toast.show("Starting", f"Normalizing with {mode_name}...", "info")
        self.status_label.config(text=f"🤖 {mode_name} running...")
        
        # Run in background thread
        def normalize_task():
            try:
                # Initialize normalizer with config
                normalizer = AgenticNormalizer(
                    config=self.config.config,
                    max_workers=4,
                )
                
                # Extract just the course names
                terms = [t for _, t in course_data]
                
                # Run normalization with selected mode
                if use_council:
                    results = normalizer.normalize_with_council(terms, num_models=3, batch_size=10, show_progress=False)
                else:
                    results = normalizer.normalize_courses(terms, batch_size=10, show_progress=False)
                
                # Update UI in main thread
                self.root.after(0, lambda: self._apply_normalization_results(course_data, results, normalizer.get_stats(), use_council))
                
            except Exception as e:
                self.root.after(0, lambda: self.toast.show("Error", f"Normalization failed: {e}", "error"))
                self.root.after(0, lambda: self.status_label.config(text="Ready"))
        
        threading.Thread(target=normalize_task, daemon=True).start()
    
    def _apply_normalization_results(self, course_data, results, stats, use_council=False):
        """Apply normalization results to the Treeview."""
        updated = 0
        
        for (item_id, original), decision in zip(course_data, results):
            if decision.confidence >= 0.7:  # Only apply confident normalizations
                values = list(self.tree.item(item_id, "values"))
                
                # Update suggested column (index 2) and status (index 3)
                if len(values) >= 4:
                    values[2] = decision.normalized
                    
                    # Set status based on match type
                    match_type = decision.match_type
                    if match_type in ("council_unanimous", "exact") or decision.confidence >= 0.95:
                        values[3] = "Auto-Matched"
                    elif match_type == "council_majority" or decision.confidence >= 0.80:
                        values[3] = "Possible Match"
                    elif match_type == "council_split":
                        values[3] = "Review Required"
                    else:
                        values[3] = "Review Required"
                    
                    self.tree.item(item_id, values=values)
                    updated += 1
        
        # Show summary
        self.status_label.config(text="Ready")
        
        if use_council:
            msg = f"Updated: {updated} | Council votes: {stats.get('council_votes', 0)} | Cache: {stats['cache_hits']} | Time: {stats['total_time_seconds']:.1f}s"
        else:
            msg = f"Updated: {updated} | Cache: {stats['cache_hits']} | LLM: {stats.get('llm_normalizations', 0)} | Time: {stats['total_time_seconds']:.1f}s"
        
        self.toast.show("Normalization Complete", msg, "success")
        
        # Refresh dashboard if visible
        if self.current_view == "dashboard":
            self.dashboard.update_dashboard()

    def run_ai_assist(self):
        """Run AI assist on selected item"""
        if not self.tree.selection():
            messagebox.showinfo("No Selection", "Please select a course name to analyze.")
            return
        
        selected = self.tree.selection()[0]
        values = self.tree.item(selected, "values")
        original = values[1]
        
        AIAssistWindow(self.root, original, self.nlp, self.processor.standard_terms)
    
    def export_learned_corrections(self):
        """Export AI-learned corrections to Excel for review."""
        from pathlib import Path
        from tkinter import filedialog
        
        try:
            normalizer = AgenticNormalizer(
                config=self.config.config,
                max_workers=1,
            )
            
            # Check if there are corrections to export
            stats = normalizer.get_stats()
            if stats['cache_size'] == 0 and stats['error_map_size'] == 0:
                self.toast.show("Nothing to Export", "No learned corrections found. Run the normalizer first.", "warning")
                return
            
            # Ask for save location
            filepath = filedialog.asksaveasfilename(
                defaultextension=".xlsx",
                filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")],
                title="Export Learned Corrections",
                initialfile="learned_corrections.xlsx"
            )
            
            if not filepath:
                return
            
            # Export
            count = normalizer.export_corrections_excel(Path(filepath))
            self.toast.show("Exported", f"Saved {count} corrections to {Path(filepath).name}", "success")
        except Exception as e:
            self.toast.show("Error", f"Export failed: {e}", "error")
    
    def show_review_queue(self):
        """Show pending items that need human review."""
        # Get items marked as "Review Required"
        review_items = []
        for item_id in self.tree.get_children():
            values = self.tree.item(item_id, "values")
            if len(values) >= 4 and values[3] in ("Review Required", "Possible Match"):
                review_items.append({
                    "id": item_id,
                    "original": values[1] if len(values) > 1 else "",
                    "suggested": values[2] if len(values) > 2 else "",
                    "status": values[3] if len(values) > 3 else "",
                })
        
        if not review_items:
            self.toast.show("No Items", "No items pending review.", "info")
            return
        
        # Show review window
        ReviewQueueWindow(self.root, review_items, self.tree, self.toast)
    
    def batch_process_files(self):
        """Batch process multiple files"""
        files = filedialog.askopenfilenames(
            filetypes=[('Data files', '*.xlsx *.xls *.csv')]
        )
        if files:
            try:
                BatchProcessDialog(self.root, self.processor, list(files))
                # Refresh UI after processing
                self.root.after(500, self.refresh_ui)
            except Exception as e:
                messagebox.showerror("Error", f"Batch processing failed: {e}")
    
    def save_session(self):
        """Save current session state to a file."""
        filepath = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[('Session files', '*.json'), ('All files', '*.*')],
            title="Save Session"
        )
        if filepath:
            try:
                import json
                session_data = {
                    'tree_data': [],
                    'loaded_files': getattr(self, 'loaded_files', [])
                }
                # Save tree data
                for item_id in self.tree.get_children():
                    values = self.tree.item(item_id, 'values')
                    session_data['tree_data'].append(list(values))
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(session_data, f, indent=2, ensure_ascii=False)
                
                self.toast.show("Saved", f"Session saved to {Path(filepath).name}", "success")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save session: {e}")
    
    def load_session(self):
        """Load session state from a file."""
        filepath = filedialog.askopenfilename(
            filetypes=[('Session files', '*.json'), ('All files', '*.*')],
            title="Load Session"
        )
        if filepath:
            try:
                import json
                with open(filepath, 'r', encoding='utf-8') as f:
                    session_data = json.load(f)
                
                # Clear existing data
                for item in self.tree.get_children():
                    self.tree.delete(item)
                
                # Load tree data
                for row in session_data.get('tree_data', []):
                    self.tree.insert('', 'end', values=row)
                
                self.loaded_files = session_data.get('loaded_files', [])
                self.toast.show("Loaded", f"Session loaded from {Path(filepath).name}", "success")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load session: {e}")
    
    # ========== Missing Menu Methods (Stubs) ==========
    
    def show_quality_report(self):
        """Show quality report for normalized data."""
        total = len(self.tree.get_children())
        if total == 0:
            messagebox.showinfo("Quality Report", "No data to analyze.")
            return
        
        stats = {"Matched": 0, "Review Required": 0, "Other": 0}
        for item_id in self.tree.get_children():
            values = self.tree.item(item_id, 'values')
            status = values[3] if len(values) > 3 else "Other"
            if status in stats:
                stats[status] += 1
            else:
                stats["Other"] += 1
        
        report = f"Quality Report\n{'='*30}\n"
        report += f"Total Records: {total}\n"
        for status, count in stats.items():
            pct = (count / total) * 100 if total > 0 else 0
            report += f"{status}: {count} ({pct:.1f}%)\n"
        
        messagebox.showinfo("Quality Report", report)
    
    def view_audit_log(self):
        """View audit log of changes."""
        messagebox.showinfo("Audit Log", "Audit log feature coming soon.")
    
    def add_to_error_map(self):
        """Add selected item to error map."""
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("No Selection", "Please select a row first.")
            return
        values = self.tree.item(selected[0], 'values')
        if len(values) >= 3:
            original = values[1]
            correction = values[2]
            self.processor.error_map[original.upper()] = correction.upper()
            self.processor.save_error_map(self.processor.error_map)
            self.toast.show("Added", f"Added to error map: {original} → {correction}", "success")
    
    def add_to_ignore_list(self):
        """Add selected item to ignore list."""
        self.toast.show("Info", "Ignore list feature coming soon.", "info")
    
    def apply_suggestion(self):
        """Apply a normalization suggestion."""
        self.toast.show("Info", "Use right-click context menu to apply suggestions.", "info")
    
    def approve_all(self):
        """Approve all items in the list."""
        count = 0
        for item_id in self.tree.get_children():
            self.tree.set(item_id, 'Status', 'Matched')
            count += 1
        self.toast.show("Approved", f"Approved {count} items.", "success")
    
    def approve_selected(self):
        """Approve selected items."""
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("No Selection", "Please select rows first.")
            return
        for item_id in selected:
            self.tree.set(item_id, 'Status', 'Matched')
        self.toast.show("Approved", f"Approved {len(selected)} items.", "success")
    
    def reject_selected(self):
        """Reject selected items."""
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("No Selection", "Please select rows first.")
            return
        for item_id in selected:
            self.tree.set(item_id, 'Status', 'Rejected')
        self.toast.show("Rejected", f"Rejected {len(selected)} items.", "info")
    
    def bulk_apply_possible(self):
        """Bulk apply all possible matches."""
        count = 0
        for item_id in self.tree.get_children():
            values = self.tree.item(item_id, 'values')
            if len(values) > 3 and values[3] == "Possible Match":
                self.tree.set(item_id, 'Status', 'Matched')
                count += 1
        self.toast.show("Applied", f"Applied {count} possible matches.", "success")
    
    def check_error_conflicts(self):
        """Check for conflicts in error map."""
        conflicts = []
        for orig, corr in self.processor.error_map.items():
            if orig == corr:
                conflicts.append(orig)
        if conflicts:
            messagebox.showwarning("Conflicts", f"Found {len(conflicts)} self-referencing entries.")
        else:
            self.toast.show("Check Complete", "No conflicts found.", "success")
    
    def delete_row(self):
        """Delete selected row."""
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("No Selection", "Please select a row first.")
            return
        for item_id in selected:
            self.tree.delete(item_id)
        self.toast.show("Deleted", f"Deleted {len(selected)} rows.", "info")
    
    def quick_add_error_map(self):
        """Quick add to error map from context menu."""
        self.add_to_error_map()
    
    def quick_add_standard(self):
        """Quick add to standard courses."""
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("No Selection", "Please select a row first.")
            return
        values = self.tree.item(selected[0], 'values')
        if len(values) >= 3:
            correction = values[2].upper()
            if correction not in self.processor.standard_terms:
                self.processor.standard_terms.append(correction)
                self.processor.save_standards(self.processor.standard_terms)
                self.toast.show("Added", f"Added to standards: {correction}", "success")
    
    def show_context_menu(self, event):
        """Show context menu on right-click"""
        # Select row under cursor
        row_id = self.tree.identify_row(event.y)
        if row_id:
            self.tree.selection_set(row_id)
            
            # Create context menu
            context_menu = tk.Menu(self.root, tearoff=0)
            context_menu.add_command(label="Apply Suggestion to Final", command=self.apply_suggestion)
            context_menu.add_command(label="Add to Error Map...", command=self.add_to_error_map)
            context_menu.add_command(label="Add to Ignore List", command=self.add_to_ignore_list)
            context_menu.add_separator()
            context_menu.add_command(label="Delete Row", command=self.delete_row)
            
            context_menu.post(event.x_root, event.y_root)
    
    def on_tree_double_click(self, event):
        """Handle double-click for cell editing"""
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
            entry.destroy()
        
        def cancel_edit(event=None):
            entry.destroy()
        
        entry.bind("<Return>", save_edit)
        entry.bind("<FocusOut>", save_edit)
        entry.bind("<Escape>", cancel_edit)


class ReviewQueueWindow:
    """Window for reviewing and approving uncertain normalizations."""
    
    def __init__(self, parent, items, tree, toast):
        self.items = items
        self.tree = tree
        self.toast = toast
        
        self.window = tk.Toplevel(parent)
        self.window.title("Review Queue")
        self.window.geometry("700x500")
        self.window.transient(parent)
        
        # Header
        ttk.Label(self.window, text=f"📋 {len(items)} items need review", font=("Segoe UI", 14, "bold")).pack(pady=10)
        
        # Create treeview for review items
        columns = ("original", "suggested", "status", "action")
        self.review_tree = ttk.Treeview(self.window, columns=columns, show="headings", height=15)
        self.review_tree.heading("original", text="Original")
        self.review_tree.heading("suggested", text="Suggested")
        self.review_tree.heading("status", text="Status")
        self.review_tree.heading("action", text="Action")
        
        self.review_tree.column("original", width=200)
        self.review_tree.column("suggested", width=200)
        self.review_tree.column("status", width=100)
        self.review_tree.column("action", width=80)
        
        # Add scrollbar
        scrollbar = ttk.Scrollbar(self.window, orient=tk.VERTICAL, command=self.review_tree.yview)
        self.review_tree.configure(yscrollcommand=scrollbar.set)
        
        self.review_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(10, 0), pady=10)
        scrollbar.pack(side=tk.LEFT, fill=tk.Y, pady=10)
        
        # Populate
        self.item_map = {}  # tree_id -> original row id
        for item in items:
            tree_id = self.review_tree.insert("", tk.END, values=(
                item["original"],
                item["suggested"],
                item["status"],
                "Pending"
            ))
            self.item_map[tree_id] = item["id"]
        
        # Buttons
        btn_frame = ttk.Frame(self.window)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(btn_frame, text="✅ Approve Selected", command=self.approve_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="✅ Approve All", command=self.approve_all).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="❌ Reject Selected", command=self.reject_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Close", command=self.window.destroy).pack(side=tk.RIGHT, padx=5)
    
    def approve_selected(self):
        """Approve selected items."""
        selected = self.review_tree.selection()
        if not selected:
            return
        
        count = 0
        for tree_id in selected:
            orig_id = self.item_map[tree_id]
            values = list(self.tree.item(orig_id, "values"))
            if len(values) >= 4:
                values[3] = "Auto-Matched"
                self.tree.item(orig_id, values=values)
                self.review_tree.set(tree_id, "action", "Approved")
                count += 1
        
        self.toast.show("Approved", f"Approved {count} items", "success")
    
    def approve_all(self):
        """Approve all items."""
        count = 0
        for tree_id, orig_id in self.item_map.items():
            values = list(self.tree.item(orig_id, "values"))
            if len(values) >= 4:
                values[3] = "Auto-Matched"
                self.tree.item(orig_id, values=values)
                self.review_tree.set(tree_id, "action", "Approved")
                count += 1
        
        self.toast.show("Approved All", f"Approved {count} items", "success")
    
    def reject_selected(self):
        """Reject selected items (clear suggestion)."""
        selected = self.review_tree.selection()
        if not selected:
            return
        
        count = 0
        for tree_id in selected:
            orig_id = self.item_map[tree_id]
            values = list(self.tree.item(orig_id, "values"))
            if len(values) >= 4:
                values[2] = ""  # Clear suggested
                values[3] = "Did Not Match"
                self.tree.item(orig_id, values=values)
                self.review_tree.set(tree_id, "action", "Rejected")
                count += 1
        
        self.toast.show("Rejected", f"Rejected {count} items", "info")


    # ========== Phase 1 Critical Features ==========
    
    def show_context_menu(self, event):
        """Show context menu on right-click"""
        # Select row under cursor
        row_id = self.tree.identify_row(event.y)
        if row_id:
            self.tree.selection_set(row_id)
            
            # Create context menu
            context_menu = tk.Menu(self.root, tearoff=0)
            context_menu.add_command(label="Apply Suggestion to Final", command=self.apply_suggestion)
            context_menu.add_command(label="Add to Error Map...", command=self.add_to_error_map)
            context_menu.add_command(label="Add to Ignore List", command=self.add_to_ignore_list)
            context_menu.add_separator()
            context_menu.add_command(label="Delete Row", command=self.delete_row)
            
            context_menu.post(event.x_root, event.y_root)
    
    def apply_suggestion(self):
        """Apply suggested value to final column for selected rows"""
        selected = self.tree.selection()
        if not selected:
            return
        
        for item_id in selected:
            values = self.tree.item(item_id, "values")
            suggested = values[2]
            
            # Track for undo
            old_final = values[5]
            self.push_to_undo('edit', item_id, 'final', old_final, suggested)
            
            # Update database
            self.db.update_record(item_id, {"final": suggested})
        
        self.refresh_ui()
        messagebox.showinfo("Applied", f"Applied {len(selected)} suggestion(s) to Final.")
    
    def add_to_error_map(self):
        """Add selected item to error map"""
        selected = self.tree.selection()
        if not selected:
            return
        
        item_id = selected[0]
        values = self.tree.item(item_id, "values")
        original = values[1]
        
        correction = simpledialog.askstring("Add to Error Map", 
                                           f"Enter the correct value for:\n{original}")
        if correction:
            self.processor.error_map[original.upper()] = correction.upper()
            self.processor.save_error_map(self.processor.error_map)
            messagebox.showinfo("Success", "Added to error map. Reprocess data to apply.")
    
    def add_to_ignore_list(self):
        """Add selected item to ignore list"""
        selected = self.tree.selection()
        if not selected:
            return
        
        item_id = selected[0]
        values = self.tree.item(item_id, "values")
        original = values[1]
        
        ignore_list = self.config.get("ignore_list", [])
        if original.upper() not in ignore_list:
            ignore_list.append(original.upper())
            self.config.set("ignore_list", ignore_list)
            messagebox.showinfo("Success", "Added to ignore list. Reprocess data to apply.")
    
    def delete_row(self):
        """Delete selected rows"""
        selected = self.tree.selection()
        if not selected:
            return
        
        if messagebox.askyesno("Confirm Delete", f"Delete {len(selected)} row(s)?"):
            for item_id in selected:
                self.db.cursor.execute("DELETE FROM processed_courses WHERE id = ?", (item_id,))
            self.db.conn.commit()
            self.refresh_ui()
    
    def bulk_apply_possible(self):
        """Bulk apply all 'Possible Match' suggestions to final"""
        # Count possible matches
        count = self.db.cursor.execute(
            "SELECT COUNT(*) FROM processed_courses WHERE status = 'Possible Match'"
        ).fetchone()[0]
        
        if count == 0:
            messagebox.showinfo("No Matches", "No 'Possible Match' records found.")
            return
        
        if not messagebox.askyesno("Bulk Apply", 
                                   f"Apply {count} 'Possible Match' suggestions to Final?\n" +
                                   "This cannot be easily undone."):
            return
        
        # Apply
        self.db.cursor.execute("""
            UPDATE processed_courses 
            SET final = suggested 
            WHERE status = 'Possible Match'
        """)
        self.db.conn.commit()
        
        self.refresh_ui()
        messagebox.showinfo("Success", f"Applied {count} suggestions.")
    
    def save_session(self):
        """Save current session to file"""
        filepath = filedialog.asksaveasfilename(
            defaultextension=".db",
            filetypes=[("Database files", "*.db"), ("All files", "*.*")]
        )
        if not filepath:
            return
        
        try:
            import shutil
            # If using in-memory, we need to backup to disk
            if self.db.db_path == ":memory:":
                # Create a disk-based connection and copy
                disk_conn = sqlite3.connect(filepath)
                self.db.conn.backup(disk_conn)
                disk_conn.close()
            else:
                shutil.copy(self.db.db_path, filepath)
            
            messagebox.showinfo("Session Saved", f"Session saved to:\n{filepath}")
        except Exception as e:
            messagebox.showerror("Save Error", f"Failed to save session:\n{e}")
    
    def load_session(self):
        """Load session from file"""
        filepath = filedialog.askopenfilename(
            filetypes=[("Database files", "*.db"), ("All files", "*.*")]
        )
        if not filepath:
            return
        
        try:
            # Close current connection
            self.db.close()
            
            # Load new database
            self.db = DatabaseManager(filepath)
            
            # Refresh UI
            self.refresh_ui()
            messagebox.showinfo("Session Loaded", "Session loaded successfully.")
        except Exception as e:
            messagebox.showerror("Load Error", f"Failed to load session:\n{e}")
            # Reconnect to in-memory fallback
            self.db = DatabaseManager()
    
    def push_to_undo(self, action_type, record_id, field, old_value, new_value):
        """Push an action to the undo stack"""
        self.undo_stack.append({
            'type': action_type,
            'record_id': record_id,
            'field': field,
            'old_value': old_value,
            'new_value': new_value
        })
        # Clear redo stack on new action
        self.redo_stack.clear()
    
    def undo(self):
        """Undo last action"""
        if not self.undo_stack:
            messagebox.showinfo("Undo", "Nothing to undo.")
            return
        
        action = self.undo_stack.pop()
        
        # Perform undo
        if action['type'] == 'edit':
            self.db.update_record(action['record_id'], {action['field']: action['old_value']})
            self.redo_stack.append(action)
        
        self.refresh_ui()
    
    def redo(self):
        """Redo last undone action"""
        if not self.redo_stack:
            messagebox.showinfo("Redo", "Nothing to redo.")
            return
        
        action = self.redo_stack.pop()
        
        # Perform redo
        if action['type'] == 'edit':
            self.db.update_record(action['record_id'], {action['field']: action['new_value']})
            self.undo_stack.append(action)
        
        self.refresh_ui()

    # ========== Phase 2 & 3 Feature Methods ==========
    
    def show_quality_report(self):
        """Generate and display quality report"""
        quality_data = self.processor.generate_quality_report()
        QualityReportWindow(self.root, quality_data)

    def check_error_conflicts(self):
        """Check and display error map conflicts"""
        conflicts = self.processor.check_conflicts()
        ConflictReportWindow(self.root, conflicts)

    def view_audit_log(self):
        """Open audit log viewer"""
        AuditLogViewerWindow(self.root, self.db)

    def on_search_changed(self, *args):
        """Handle live search with debouncing"""
        # Cancel previous search timer
        if hasattr(self, '_search_timer'):
            self.root.after_cancel(self._search_timer)
        
        # Schedule new search after 300ms
        self._search_timer = self.root.after(500, self.perform_search)

    def perform_search(self):
        """Perform the actual search (debounced)"""
        query = self.search_var.get().strip().upper()
        
        # Clear tree (optimized)
        children = self.tree.get_children()
        if children:
            self.tree.delete(*children)
        
        # Apply filters
        filter_status = self.status_filter_var.get()
        filters = {}
        if filter_status != "All":
            filters["status"] = filter_status
        
        # Load data
        data = self.db.get_processed_data(limit=1000, filters=filters)
        
        for row in data:
            row_id, file, original, suggested, score, status, final = row
            
            # Apply search filter
            if query and query not in original.upper() and query not in suggested.upper() and query not in final.upper():
                continue
            
            tags = []
            if status == "Auto-Matched": tags.append('auto_status')
            elif status == "Possible Match": tags.append('possible_status')
            elif status == "Did Not Match": tags.append('dnm_status')
            
            self.tree.insert("", "end", iid=row_id, values=(file, original, suggested, score, status, final), tags=tags)

    def on_tree_double_click(self, event):
        """Handle double-click for cell editing"""
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
        """Quickly add selected item to error map"""
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
        """Quickly add correction as standard term"""
        correction = self.quick_edit_correction.get().strip().upper()
        
        if not correction:
            messagebox.showwarning("Input Required", "Please enter a correction first.")
            return
        
        if correction not in self.processor.standard_terms:
            self.processor.standard_terms.append(correction)
            self.processor.save_standards(self.processor.standard_terms)
            self.quick_edit_correction.set("")
            messagebox.showinfo("Success", "Added as standard term. Reprocess to apply.")
