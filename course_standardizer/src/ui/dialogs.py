import tkinter as tk
from tkinter import ttk, messagebox
import re

class FindReplaceWindow(tk.Toplevel):
    def __init__(self, parent, tree, database, refresh_callback):
        super().__init__(parent)
        self.tree = tree
        self.db = database
        self.refresh_callback = refresh_callback
        self.title("Find and Replace")
        self.geometry("400x250")
        self.transient(parent)
        self.grab_set()
        
        self.find_var = tk.StringVar()
        self.replace_var = tk.StringVar()
        self.column_var = tk.StringVar(value="Original")
        self.match_case_var = tk.BooleanVar()
        self.match_cell_var = tk.BooleanVar()
        self.last_found_index = -1

        self.setup_ui()

    def setup_ui(self):
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        frame.columnconfigure(1, weight=1)

        ttk.Label(frame, text="Find what:").grid(row=0, column=0, sticky="w", padx=5, pady=2)
        ttk.Entry(frame, textvariable=self.find_var).grid(row=0, column=1, columnspan=2, sticky="ew", padx=5, pady=2)
        ttk.Label(frame, text="Replace with:").grid(row=1, column=0, sticky="w", padx=5, pady=2)
        ttk.Entry(frame, textvariable=self.replace_var).grid(row=1, column=1, columnspan=2, sticky="ew", padx=5, pady=2)
        
        ttk.Label(frame, text="Search In:").grid(row=2, column=0, sticky="w", padx=5, pady=5)
        ttk.Combobox(frame, textvariable=self.column_var, values=["Original", "Suggested", "Final"], state="readonly").grid(row=2, column=1, columnspan=2, sticky="ew", padx=5, pady=5)

        options_frame = ttk.Frame(frame)
        options_frame.grid(row=3, column=0, columnspan=3, sticky='w', pady=5)
        ttk.Checkbutton(options_frame, text="Match case", variable=self.match_case_var).pack(side=tk.LEFT, padx=5)
        ttk.Checkbutton(options_frame, text="Match entire cell", variable=self.match_cell_var).pack(side=tk.LEFT, padx=5)

        button_frame = ttk.Frame(frame)
        button_frame.grid(row=4, column=0, columnspan=3, pady=10)
        ttk.Button(button_frame, text="Find Next", command=self.find_next).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Replace", command=self.replace).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Replace All", command=self.replace_all).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Close", command=self.destroy).pack(side=tk.LEFT, padx=5)

    def find_next(self, wrap_search=True):
        find_text = self.find_var.get()
        if not find_text: return

        all_items = self.tree.get_children('')
        if not all_items: return

        start_index = self.last_found_index + 1 if self.last_found_index >= 0 else 0
        
        col_map = {"Original": 1, "Suggested": 2, "Final": 5}
        col_idx = col_map[self.column_var.get()]

        for i in range(start_index, len(all_items)):
            item_id = all_items[i]
            cell_value = self.tree.item(item_id, "values")[col_idx]
            
            if self._is_match(cell_value, find_text):
                self.tree.selection_set(item_id)
                self.tree.focus(item_id)
                self.tree.see(item_id)
                self.last_found_index = i
                return
        
        if wrap_search and start_index > 0:
            self.last_found_index = -1
            messagebox.showinfo("Search", "Reached end of data. Searching from beginning.", parent=self)
            self.find_next(wrap_search=False)
        elif not wrap_search:
            self.last_found_index = -1
            messagebox.showinfo("Search", "No more matches found.", parent=self)

    def replace(self):
        selected_items = self.tree.selection()
        if not selected_items:
            self.find_next()
            return
        
        item_id = selected_items[0]
        col_map = {"Original": 1, "Suggested": 2, "Final": 5}
        db_col_map = {"Original": "original", "Suggested": "suggested", "Final": "final"}
        col_idx = col_map[self.column_var.get()]
        db_col_name = db_col_map[self.column_var.get()]

        old_value = str(self.tree.item(item_id, "values")[col_idx])
        find_text = self.find_var.get()
        replace_text = self.replace_var.get()
        
        if self._is_match(old_value, find_text):
            if self.match_cell_var.get(): new_value = replace_text
            else:
                if self.match_case_var.get(): new_value = old_value.replace(find_text, replace_text)
                else:
                    pattern = re.compile(re.escape(find_text), re.IGNORECASE)
                    new_value = pattern.sub(replace_text, old_value)
            
            self.db.update_record(item_id, {db_col_name: new_value})
            self.refresh_callback()
        
        self.find_next()

    def replace_all(self):
        find_text = self.find_var.get()
        replace_text = self.replace_var.get()
        if not find_text: return
        
        db_col_map = {"Original": "original", "Suggested": "suggested", "Final": "final"}
        db_col_name = db_col_map[self.column_var.get()]
        
        self.db.cursor.execute(f"SELECT id, {db_col_name} FROM processed_courses")
        all_rows = self.db.cursor.fetchall()
        
        count = 0
        for row_id, cell_value in all_rows:
            if self._is_match(cell_value, find_text):
                count += 1
                if self.match_cell_var.get(): new_value = replace_text
                else:
                    if self.match_case_var.get(): new_value = cell_value.replace(find_text, replace_text)
                    else:
                        pattern = re.compile(re.escape(find_text), re.IGNORECASE)
                        new_value = pattern.sub(replace_text, cell_value)
                self.db.update_record(row_id, {db_col_name: new_value})
        
        if count > 0:
            self.refresh_callback()
        
        messagebox.showinfo("Replace All", f"Completed. Made {count} replacement(s).", parent=self)

    def _is_match(self, cell_value, find_text):
        cell_value = str(cell_value)
        val_to_check = cell_value if self.match_case_var.get() else cell_value.upper()
        find_to_check = find_text if self.match_case_var.get() else find_text.upper()
        if self.match_cell_var.get(): return val_to_check == find_to_check
        else: return find_to_check in val_to_check
# Add to dialogs.py - Learning Suggestion Dialog

class LearningSuggestionDialog(tk.Toplevel):
    """Dialog for suggesting learned patterns"""
    
    def __init__(self, parent, suggestions, callback):
        super().__init__(parent)
        self.callback = callback
        self.suggestions = suggestions
        self.current_index = 0
        
        self.title("Learning Suggestions")
        self.geometry("500x300")
        self.transient(parent)
        self.grab_set()
        
        self.setup_ui()
        self.show_suggestion()
    
    def setup_ui(self):
        """Setup UI components"""
        main_frame = ttk.Frame(self, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        ttk.Label(main_frame, text="Auto-Learning Suggestion", 
                 font=("Segoe UI", 12, "bold")).pack(pady=(0, 15))
        
        # Message
        self.message_label = ttk.Label(main_frame, 
                                      text="I've noticed you made this correction multiple times:",
                                      wraplength=450)
        self.message_label.pack(pady=(0, 10))
        
        # Pattern frame
        pattern_frame = ttk.LabelFrame(main_frame, text="Pattern", padding="10")
        pattern_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        ttk.Label(pattern_frame, text="Original:").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        self.original_label = ttk.Label(pattern_frame, text="", font=("Courier", 10))
        self.original_label.grid(row=0, column=1, sticky="w", padx=5, pady=5)
        
        ttk.Label(pattern_frame, text="→", font=("Arial", 14)).grid(row=1, column=0, padx=5)
        
        ttk.Label(pattern_frame, text="Correction:").grid(row=2, column=0, sticky="w", padx=5, pady=5)
        self.correction_label = ttk.Label(pattern_frame, text="", font=("Courier", 10, "bold"))
        self.correction_label.grid(row=2, column=1, sticky="w", padx=5, pady=5)
        
        ttk.Label(pattern_frame, text="Times corrected:").grid(row=3, column=0, sticky="w", padx=5, pady=5)
        self.count_label = ttk.Label(pattern_frame, text="", foreground="#2196F3")
        self.count_label.grid(row=3, column=1, sticky="w", padx=5, pady=5)
        
        # Question
        ttk.Label(main_frame, text="Would you like to apply this correction automatically?",
                 font=("", 10, "bold")).pack(pady=(10, 15))
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)
        
        ttk.Button(button_frame, text="✓ Add to Error Map", 
                  command=lambda: self.respond('learn')).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="✗ Ignore", 
                  command=lambda: self.respond('ignore')).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Ask Me Later", 
                  command=lambda: self.respond('defer')).pack(side=tk.LEFT, padx=5)
        
        # Progress indicator
        self.progress_label = ttk.Label(main_frame, text="")
        self.progress_label.pack(pady=(15, 0))
    
    def show_suggestion(self):
        """Show current suggestion"""
        if self.current_index >= len(self.suggestions):
            self.destroy()
            return
        
        suggestion = self.suggestions[self.current_index]
        self.original_label.config(text=suggestion['original'])
        self.correction_label.config(text=suggestion['correction'])
        self.count_label.config(text=f"{suggestion['count']} times")
        self.progress_label.config(text=f"Suggestion {self.current_index + 1} of {len(self.suggestions)}")
    
    def respond(self, action):
        """Respond to suggestion"""
        suggestion = self.suggestions[self.current_index]
        self.callback(suggestion['original'], suggestion['correction'], action)
        
        # Move to next suggestion
        self.current_index += 1
        self.show_suggestion()
