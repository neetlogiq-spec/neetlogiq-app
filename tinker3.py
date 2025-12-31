"""
Course Standardizer Workbench v7.0

A graphical user interface (GUI) application built with Tkinter for cleaning,
standardizing, and correcting course names from various data files (Excel/CSV).

This version includes:
- Advanced text processing with lemmatization and semantic matching
- Enhanced UI with dashboard and resizable panels
- Performance improvements with caching and lazy loading
- Quality assurance framework with validation and audit trails
- AI enhancements with active learning and semantic matching
"""

import tkinter as tk
from tkinter import filedialog, ttk, messagebox, scrolledtext, simpledialog
import pandas as pd
from rapidfuzz import process, fuzz
import os
import json
import sqlite3
import difflib
import uuid
import re
import time
import functools
from datetime import datetime

# Enhanced imports for new features
import nltk
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

# --- Dependency Checks ---
try:
    import sv_ttk
except ImportError:
    messagebox.showerror("Missing Library", "The 'sv_ttk' library is required.\nPlease install it by running: pip install sv_ttk")
    exit()
try:
    import spacy
except ImportError:
    messagebox.showerror("Missing Library", "The 'spacy' library is required for AI Assist.\nPlease install it by running: pip install spacy")
    exit()

# --- Configuration ---
DEFAULT_ERRORS_FILE = "errors_and_corrections.xlsx"
DEFAULT_STANDARDS_FILE = "standard_courses.xlsx"
AUDIT_FILE = "audit_log.json"
EMBEDDED_STANDARD_TERMS = [
    "DIPLOMA IN ANESTHESIA", "DIPLOMA IN CLINICAL PATHOLOGY", "MD IN GENERAL MEDICINE",
    "MS IN GENERAL SURGERY", "DM IN CARDIOLOGY", "MCH IN NEUROSURGERY", "BDS", "MBBS"
]

# --- Manager & Tool Windows (Toplevels) ---
class FindReplaceWindow(tk.Toplevel):
    """A Toplevel window for Find and Replace functionality."""
    def __init__(self, parent_app):
        super().__init__(parent_app.root)
        self.parent_app = parent_app
        self.title("Find and Replace")
        self.geometry("400x200")
        self.transient(parent_app.root)
        self.grab_set()
        
        self.find_var = tk.StringVar()
        self.replace_var = tk.StringVar()
        self.column_var = tk.StringVar(value="Original")
        self.match_case_var = tk.BooleanVar()
        self.match_cell_var = tk.BooleanVar()
        self.last_found_index = -1

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
        
        self.protocol("WM_DELETE_WINDOW", self.destroy)

    def find_next(self, wrap_search=True):
        find_text = self.find_var.get()
        if not find_text: return

        all_items = self.parent_app.tree.get_children('')
        if not all_items: return

        start_index = self.last_found_index + 1 if self.last_found_index >= 0 else 0
        
        col_map = {"Original": 1, "Suggested": 2, "Final": 5}
        col_idx = col_map[self.column_var.get()]

        for i in range(start_index, len(all_items)):
            item_id = all_items[i]
            cell_value = self.parent_app.tree.item(item_id, "values")[col_idx]
            
            if self._is_match(cell_value, find_text):
                self.parent_app.tree.selection_set(item_id)
                self.parent_app.tree.focus(item_id)
                self.parent_app.tree.see(item_id)
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
        selected_items = self.parent_app.tree.selection()
        if not selected_items:
            self.find_next()
            return
        
        item_id = selected_items[0]
        col_map = {"Original": 1, "Suggested": 2, "Final": 5}
        db_col_map = {"Original": "original", "Suggested": "suggested", "Final": "final"}
        col_idx = col_map[self.column_var.get()]
        db_col_name = db_col_map[self.column_var.get()]

        old_value = str(self.parent_app.tree.item(item_id, "values")[col_idx])
        find_text = self.find_var.get()
        replace_text = self.replace_var.get()
        
        if self._is_match(old_value, find_text):
            if self.match_cell_var.get(): new_value = replace_text
            else:
                if self.match_case_var.get(): new_value = old_value.replace(find_text, replace_text)
                else:
                    pattern = re.compile(re.escape(find_text), re.IGNORECASE)
                    new_value = pattern.sub(replace_text, old_value)
            
            self.parent_app.cursor.execute(f"UPDATE processed_courses SET {db_col_name}=? WHERE id=?", (new_value, item_id))
            self.parent_app.conn.commit()
            self.parent_app.refresh_tree()
        
        self.find_next()

    def replace_all(self):
        find_text = self.find_var.get()
        replace_text = self.replace_var.get()
        if not find_text: return
        
        db_col_map = {"Original": "original", "Suggested": "suggested", "Final": "final"}
        db_col_name = db_col_map[self.column_var.get()]
        
        self.parent_app.cursor.execute(f"SELECT id, {db_col_name} FROM processed_courses")
        all_rows = self.parent_app.cursor.fetchall()
        
        updates_to_perform = []
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
                updates_to_perform.append((new_value, row_id))
        
        if updates_to_perform:
            self.parent_app.cursor.executemany(f"UPDATE processed_courses SET {db_col_name}=? WHERE id=?", updates_to_perform)
            self.parent_app.conn.commit()
            self.parent_app.refresh_tree()
        
        messagebox.showinfo("Replace All", f"Completed. Made {count} replacement(s).", parent=self)

    def _is_match(self, cell_value, find_text):
        cell_value = str(cell_value)
        val_to_check = cell_value if self.match_case_var.get() else cell_value.upper()
        find_to_check = find_text if self.match_case_var.get() else find_text.upper()
        if self.match_cell_var.get(): return val_to_check == find_to_check
        else: return find_to_check in val_to_check

class StandardsManagerWindow(tk.Toplevel):
    def __init__(self, parent_app):
        super().__init__(parent_app.root)
        self.parent_app = parent_app
        self.title("Manage Standard Courses")
        self.geometry("600x400")
        self.transient(parent_app.root)
        self.grab_set()
        self.temp_standards = parent_app.standard_terms.copy()
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        list_frame = ttk.Frame(frame)
        list_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.listbox = tk.Listbox(list_frame)
        self.listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.listbox.config(yscrollcommand=scrollbar.set)
        self.listbox.bind("<<ListboxSelect>>", self.on_select)
        entry_frame = ttk.Frame(frame)
        entry_frame.pack(fill=tk.X, pady=5)
        ttk.Label(entry_frame, text="Course:").pack(side=tk.LEFT, padx=(0, 5))
        self.entry_var = tk.StringVar()
        self.entry = ttk.Entry(entry_frame, textvariable=self.entry_var)
        self.entry.pack(side=tk.LEFT, expand=True, fill=tk.X)
        action_frame = ttk.Frame(frame)
        action_frame.pack(fill=tk.X)
        ttk.Button(action_frame, text="Add", command=self.add_term).pack(side=tk.LEFT, padx=5)
        self.update_button = ttk.Button(action_frame, text="Update", command=self.update_term, state="disabled")
        self.update_button.pack(side=tk.LEFT, padx=5)
        self.delete_button = ttk.Button(action_frame, text="Delete", command=self.delete_term, state="disabled")
        self.delete_button.pack(side=tk.LEFT, padx=5)
        bottom_frame = ttk.Frame(frame)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=(10, 0))
        ttk.Button(bottom_frame, text="Save and Close", command=self.save).pack(side=tk.RIGHT)
        ttk.Button(bottom_frame, text="Cancel", command=self.destroy).pack(side=tk.RIGHT, padx=10)
        self.populate_list()
        self.protocol("WM_DELETE_WINDOW", self.destroy)
    def populate_list(self):
        self.listbox.delete(0, tk.END)
        for term in sorted(self.temp_standards): self.listbox.insert(tk.END, term)
        self.entry_var.set("")
        self.update_button.config(state="disabled")
        self.delete_button.config(state="disabled")
    def on_select(self, event=None):
        if not self.listbox.curselection(): return
        self.entry_var.set(self.listbox.get(self.listbox.curselection()))
        self.update_button.config(state="normal")
        self.delete_button.config(state="normal")
    def add_term(self):
        new_term = self.entry_var.get().strip().upper()
        if not new_term: return messagebox.showwarning("Input Error", "Course name cannot be empty.", parent=self)
        if new_term in self.temp_standards: return messagebox.showwarning("Input Error", "This course already exists.", parent=self)
        self.temp_standards.append(new_term)
        self.populate_list()
    def update_term(self):
        if not self.listbox.curselection(): return
        old_term = self.listbox.get(self.listbox.curselection()[0])
        new_term = self.entry_var.get().strip().upper()
        if not new_term: return messagebox.showwarning("Input Error", "Course name cannot be empty.", parent=self)
        if new_term in self.temp_standards and new_term != old_term: return messagebox.showwarning("Input Error", "This course already exists.", parent=self)
        self.temp_standards[self.temp_standards.index(old_term)] = new_term
        self.populate_list()
    def delete_term(self):
        if not self.listbox.curselection(): return
        selected_term = self.listbox.get(self.listbox.curselection())
        if messagebox.askyesno("Confirm Delete", f"Delete '{selected_term}'?", parent=self):
            self.temp_standards.remove(selected_term)
            self.populate_list()
    def save(self):
        self.parent_app.standard_terms = sorted(self.temp_standards)
        self.parent_app.save_standard_terms()
        self.parent_app.populate_standards_list()
        messagebox.showinfo("Success", f"Standard courses saved.", parent=self.parent_app.root)
        self.destroy()

class ErrorsManagerWindow(tk.Toplevel):
    def __init__(self, parent_app):
        super().__init__(parent_app.root)
        self.parent_app = parent_app
        self.title("Manage Error Map")
        self.geometry("800x500")
        self.transient(parent_app.root)
        self.grab_set()
        self.temp_error_map = parent_app.error_map.copy()
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        tree_frame = ttk.Frame(frame)
        tree_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        columns = ("Error", "Correction")
        self.tree = ttk.Treeview(tree_frame, columns=columns, show="headings")
        self.tree.heading("Error", text="Error Term"); self.tree.heading("Correction", text="Corrected Term")
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.config(yscrollcommand=scrollbar.set)
        self.tree.bind("<<TreeviewSelect>>", self.on_select)
        entry_frame = ttk.Labelframe(frame, text="Edit Entry"); entry_frame.pack(fill=tk.X, pady=5)
        entry_frame.columnconfigure(1, weight=1)
        ttk.Label(entry_frame, text="Error:").grid(row=0, column=0, padx=5, pady=2, sticky='w')
        self.error_var = tk.StringVar(); ttk.Entry(entry_frame, textvariable=self.error_var).grid(row=0, column=1, padx=5, pady=2, sticky='ew')
        ttk.Label(entry_frame, text="Correction:").grid(row=1, column=0, padx=5, pady=2, sticky='w')
        self.correction_var = tk.StringVar(); ttk.Entry(entry_frame, textvariable=self.correction_var).grid(row=1, column=1, padx=5, pady=2, sticky='ew')
        action_frame = ttk.Frame(frame); action_frame.pack(fill=tk.X, pady=5)
        ttk.Button(action_frame, text="Add", command=self.add_entry).pack(side=tk.LEFT, padx=5)
        self.update_button = ttk.Button(action_frame, text="Update", command=self.update_entry, state="disabled")
        self.update_button.pack(side=tk.LEFT, padx=5)
        self.delete_button = ttk.Button(action_frame, text="Delete", command=self.delete_entry, state="disabled")
        self.delete_button.pack(side=tk.LEFT, padx=5)
        bottom_frame = ttk.Frame(frame); bottom_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=(10, 0))
        ttk.Button(bottom_frame, text="Save and Close", command=self.save).pack(side=tk.RIGHT)
        ttk.Button(bottom_frame, text="Cancel", command=self.destroy).pack(side=tk.RIGHT, padx=10)
        self.populate_tree()
        self.protocol("WM_DELETE_WINDOW", self.destroy)
    def populate_tree(self):
        self.tree.delete(*self.tree.get_children())
        for error, correction in sorted(self.temp_error_map.items()): self.tree.insert("", tk.END, values=(error, correction))
        self.error_var.set(""); self.correction_var.set("")
        self.update_button.config(state="disabled"); self.delete_button.config(state="disabled")
    def on_select(self, event=None):
        if not self.tree.selection(): return
        values = self.tree.item(self.tree.selection()[0], 'values')
        self.error_var.set(values[0]); self.correction_var.set(values[1])
        self.update_button.config(state="normal"); self.delete_button.config(state="normal")
    def add_entry(self):
        error, correction = self.error_var.get().strip().upper(), self.correction_var.get().strip().upper()
        if not error or not correction: return messagebox.showwarning("Input Error", "Both fields are required.", parent=self)
        if error in self.temp_error_map: return messagebox.showwarning("Input Error", "This error term already exists.", parent=self)
        self.temp_error_map[error] = correction
        self.populate_tree()
    def update_entry(self):
        if not self.tree.selection(): return
        error, correction = self.error_var.get().strip().upper(), self.correction_var.get().strip().upper()
        original_key = self.tree.item(self.tree.selection()[0], 'values')[0]
        if not error or not correction: return messagebox.showwarning("Input Error", "Both fields are required.", parent=self)
        if error != original_key:
            if messagebox.askyesno("Confirm Key Change", "Create new entry and delete old one?", parent=self): del self.temp_error_map[original_key]
            else: return
        self.temp_error_map[error] = correction
        self.populate_tree()
    def delete_entry(self):
        if not self.tree.selection(): return
        error_term = self.tree.item(self.tree.selection()[0], 'values')[0]
        if messagebox.askyesno("Confirm Delete", f"Delete mapping for '{error_term}'?", parent=self):
            del self.temp_error_map[error_term]
            self.populate_tree()
    def save(self):
        self.parent_app.error_map = self.temp_error_map
        self.parent_app.save_error_map()
        messagebox.showinfo("Success", f"Error map saved.", parent=self.parent_app.root)
        self.destroy()

class ValidationWindow(tk.Toplevel):
    """Window for displaying validation results"""
    def __init__(self, parent_app, results):
        super().__init__(parent_app.root)
        self.parent_app = parent_app
        self.title("Validation Results")
        self.geometry("700x500")
        self.transient(parent_app.root)
        
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        tree = ttk.Treeview(frame, columns=("Original", "Expected", "Actual", "Score", "Pass"), show="headings")
        tree.heading("Original", text="Original")
        tree.heading("Expected", text="Expected")
        tree.heading("Actual", text="Actual")
        tree.heading("Score", text="Score")
        tree.heading("Pass", text="Pass")
        
        for original, expected, actual, score, passed in results:
            tree.insert("", "end", values=(original, expected, actual, f"{score}%", "✓" if passed else "✗"))
        
        tree.pack(fill="both", expand=True)
        
        ttk.Button(frame, text="Close", command=self.destroy).pack(pady=10)

class FeedbackWindow(tk.Toplevel):
    """Window for collecting user feedback on uncertain matches"""
    def __init__(self, parent_app, uncertain_matches):
        super().__init__(parent_app.root)
        self.parent_app = parent_app
        self.title("Provide Feedback")
        self.geometry("700x600")
        self.transient(parent_app.root)
        self.grab_set()
        
        self.feedback_data = []
        
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="Please review these uncertain matches and provide feedback:", 
                 font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(0, 10))
        
        # Create scrollable frame for feedback items
        canvas = tk.Canvas(frame)
        scrollbar = ttk.Scrollbar(frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        for i, (record_id, original, suggested, score) in enumerate(uncertain_matches):
            item_frame = ttk.LabelFrame(scrollable_frame, text=f"Match {i+1}")
            item_frame.pack(fill="x", padx=5, pady=5)
            
            ttk.Label(item_frame, text=f"Original: {original}").pack(anchor="w", padx=5)
            ttk.Label(item_frame, text=f"Suggested: {suggested} (Score: {score})").pack(anchor="w", padx=5)
            
            var = tk.StringVar(value="accept")
            feedback_frame = ttk.Frame(item_frame)
            feedback_frame.pack(fill="x", padx=5, pady=5)
            
            ttk.Radiobutton(feedback_frame, text="Accept", variable=var, value="accept").pack(side="left")
            ttk.Radiobutton(feedback_frame, text="Reject", variable=var, value="reject").pack(side="left")
            ttk.Radiobutton(feedback_frame, text="Modify", variable=var, value="modify").pack(side="left")
            
            # Store feedback data
            self.feedback_data.append((record_id, var))
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        button_frame = ttk.Frame(frame)
        button_frame.pack(fill="x", pady=10)
        ttk.Button(button_frame, text="Submit Feedback", command=self.submit_feedback).pack(side="right")
        ttk.Button(button_frame, text="Cancel", command=self.destroy).pack(side="right", padx=10)
        
        self.protocol("WM_DELETE_WINDOW", self.destroy)
    
    def submit_feedback(self):
        """Process collected feedback"""
        for record_id, var in self.feedback_data:
            feedback = var.get()
            self.parent_app.process_feedback(record_id, feedback)
        
        messagebox.showinfo("Feedback Processed", "Thank you for your feedback!")
        self.destroy()

class CourseCleanerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Course Standardizer Workbench v7.0 (Enhanced)")
        self.root.geometry("1600x950")
        
        # State Variables
        self.db_path = ":memory:"
        self.conn = None
        self.cursor = None
        self.table_info = {}
        self.error_map = {}
        self.standard_terms = []
        self.last_used_course_column = None
        self.source_folder = None
        self.undo_stack = []
        self.redo_stack = []
        self.ignore_list = set()
        self.sort_column = "File"
        self.sort_reverse = False
        
        # UI Variables
        self.auto_threshold = tk.IntVar(value=90)
        self.possible_threshold = tk.IntVar(value=70)
        self.search_var = tk.StringVar()
        self.stats_var = tk.StringVar(value="Stats: Load data to begin.")
        self.quick_edit_original = tk.StringVar()
        self.quick_edit_correction = tk.StringVar()
        self.search_timer = None
        self.ignore_brackets_var = tk.BooleanVar(value=False)
        
        # New enhancement variables
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes
        self.uncertain_threshold = 75
        self.feedback_data = []
        self.semantic_enabled = False
        self.current_user = "default_user"
        
        # Initialize NLTK data
        self.init_nltk()
        
        # Initialization
        self.nlp = self.load_spacy_model()
        self.setup_database()
        self.setup_audit_system()
        self.load_default_profile()
        self.create_menu()
        self.setup_ui()
        self.bind_shortcuts()
        self.setup_semantic_matching()
        self.setup_active_learning()
        sv_ttk.set_theme("light")
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Log application start
        self.log_action("Application Start", {"version": "7.0", "timestamp": datetime.now().isoformat()})

    def init_nltk(self):
        """Initialize required NLTK data"""
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            try:
                nltk.download('punkt', quiet=True)
            except:
                pass
        
        try:
            nltk.data.find('corpora/wordnet')
        except LookupError:
            try:
                nltk.download('wordnet', quiet=True)
            except:
                pass
        
        try:
            nltk.data.find('taggers/averaged_perceptron_tagger')
        except LookupError:
            try:
                nltk.download('averaged_perceptron_tagger', quiet=True)
            except:
                pass

    def setup_ui(self):
        main_frame = ttk.Frame(self.root, padding=10)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create notebook for tabs
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # Main tab
        main_tab = ttk.Frame(self.notebook)
        self.notebook.add(main_tab, text="Data Processing")
        
        # Dashboard tab
        dashboard_tab = ttk.Frame(self.notebook)
        self.notebook.add(dashboard_tab, text="Dashboard")
        self.create_dashboard(dashboard_tab)
        
        # Validation tab
        validation_tab = ttk.Frame(self.notebook)
        self.notebook.add(validation_tab, text="Validation")
        self.create_validation_tab(validation_tab)
        
        # Setup main tab UI
        self.setup_main_tab(main_tab)

    def setup_main_tab(self, parent):
        top_controls_frame = ttk.Frame(parent)
        top_controls_frame.pack(fill=tk.X, pady=(0, 10))
        
        actions_frame = ttk.Labelframe(top_controls_frame, text="Actions")
        actions_frame.pack(side=tk.LEFT, padx=(0, 10), fill=tk.Y)
        ttk.Button(actions_frame, text="🔄 Refresh", command=self.reprocess_data).pack(side=tk.LEFT, padx=5, pady=5)
        ttk.Button(actions_frame, text="⚡ Bulk Apply", command=self.bulk_apply_possible).pack(side=tk.LEFT, padx=5, pady=5)
        ttk.Button(actions_frame, text="💾 Save Reports", command=self.save_reports).pack(side=tk.LEFT, padx=5, pady=5)
        ttk.Button(actions_frame, text="🚀 Export Files", command=self.export_corrected_files).pack(side=tk.LEFT, padx=5, pady=5)
        ttk.Button(actions_frame, text="🤖 AI Assist", command=self.run_ai_assist).pack(side=tk.LEFT, padx=5, pady=5)
        ttk.Button(actions_frame, text="📊 Collect Feedback", command=self.collect_feedback).pack(side=tk.LEFT, padx=5, pady=5)
        
        processing_options_frame = ttk.Labelframe(top_controls_frame, text="Processing Options")
        processing_options_frame.pack(side=tk.LEFT, padx=(0, 10), fill=tk.Y)
        ttk.Checkbutton(processing_options_frame, text="Ignore Brackets ()[]{}", variable=self.ignore_brackets_var).pack(side=tk.LEFT, padx=5, pady=5)
        ttk.Checkbutton(processing_options_frame, text="Semantic Matching", command=self.toggle_semantic_matching).pack(side=tk.LEFT, padx=5, pady=5)
        
        filter_frame = ttk.Labelframe(top_controls_frame, text="Filtering & Thresholds")
        filter_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Label(filter_frame, text="Auto ≥").pack(side=tk.LEFT, padx=(5,0))
        ttk.Scale(filter_frame, from_=50, to=100, variable=self.auto_threshold, orient="horizontal", length=100).pack(side=tk.LEFT)
        ttk.Label(filter_frame, text="Possible ≥").pack(side=tk.LEFT, padx=(10,0))
        ttk.Scale(filter_frame, from_=30, to=90, variable=self.possible_threshold, orient="horizontal", length=100).pack(side=tk.LEFT)
        self.status_filter = ttk.Combobox(filter_frame, values=["All", "Auto-Matched", "Possible Match", "Did Not Match"], state="readonly", width=15)
        self.status_filter.set("All")
        self.status_filter.pack(side=tk.LEFT, padx=10)
        self.status_filter.bind("<<ComboboxSelected>>", lambda e: self.refresh_tree())
        self.search_var.trace_add("write", lambda *args: self.schedule_search())
        ttk.Entry(filter_frame, textvariable=self.search_var, width=30).pack(side=tk.LEFT, padx=(0,5))
        ttk.Button(filter_frame, text="Clear", command=self.clear_filters).pack(side=tk.LEFT)
        
        ttk.Label(parent, textvariable=self.stats_var, font=("Segoe UI", 10, "bold")).pack(fill=tk.X)
        self.progress = ttk.Progressbar(parent, orient="horizontal", mode="determinate")
        self.progress.pack(fill=tk.X, pady=5)
        
        # Create resizable paned window
        self.main_pane = ttk.PanedWindow(parent, orient=tk.HORIZONTAL)
        self.main_pane.pack(fill=tk.BOTH, expand=True)
        
        left_pane = ttk.PanedWindow(self.main_pane, orient=tk.VERTICAL)
        self.main_pane.add(left_pane, weight=3)
        
        right_pane = ttk.PanedWindow(self.main_pane, orient=tk.VERTICAL)
        self.main_pane.add(right_pane, weight=1)
        
        # Tree view
        tree_frame = ttk.Frame(left_pane)
        left_pane.add(tree_frame, weight=3)
        columns = ("File", "Original", "Suggested", "Score", "Status", "Final")
        self.tree = ttk.Treeview(tree_frame, columns=columns, show="headings", selectmode="extended")
        for col in columns:
            self.tree.heading(col, text=col, command=lambda c=col: self.sort_treeview_column(c))
        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(tree_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        vsb.pack(side='right', fill='y')
        hsb.pack(side='bottom', fill='x')
        self.tree.pack(fill=tk.BOTH, expand=True)
        self.tree.bind("<Double-1>", self.edit_cell)
        self.tree.bind("<<TreeviewSelect>>", self.on_tree_select)
        self.tree.bind("<Button-3>", self.show_context_menu)
        self.tree.tag_configure('auto_status', background='#c8e6c9')
        self.tree.tag_configure('possible_status', background='#fff9c4')
        self.tree.tag_configure('dnm_status', background='#ffcdd2')
        self.tree.tag_configure('final_changed', foreground='blue')
        
        # Diff view
        diff_frame = ttk.Labelframe(left_pane, text="Difference View")
        left_pane.add(diff_frame, weight=1)
        self.diff_text = scrolledtext.ScrolledText(diff_frame, wrap=tk.WORD, state="disabled", height=5)
        self.diff_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.diff_text.tag_config('added', foreground='#4CAF50', font=("Courier New", 10, "bold"))
        self.diff_text.tag_config('removed', foreground='#F44336', overstrike=True)
        
        # Quick edit frame
        quick_edit_frame = ttk.Labelframe(right_pane, text="Quick Rule Editor")
        right_pane.add(quick_edit_frame, weight=1)
        quick_edit_frame.columnconfigure(1, weight=1)
        ttk.Label(quick_edit_frame, text="Original:").grid(row=0, column=0, padx=5, pady=5, sticky='w')
        ttk.Entry(quick_edit_frame, textvariable=self.quick_edit_original).grid(row=0, column=1, padx=5, pady=5, sticky='ew')
        ttk.Label(quick_edit_frame, text="Correction:").grid(row=1, column=0, padx=5, pady=5, sticky='w')
        ttk.Entry(quick_edit_frame, textvariable=self.quick_edit_correction).grid(row=1, column=1, padx=5, pady=5, sticky='ew')
        q_button_frame = ttk.Frame(quick_edit_frame)
        q_button_frame.grid(row=2, column=0, columnspan=2, pady=5)
        ttk.Button(q_button_frame, text="Add to Error Map", command=self.quick_add_error).pack(side=tk.LEFT, padx=5)
        ttk.Button(q_button_frame, text="Add as Standard", command=self.quick_add_standard).pack(side=tk.LEFT, padx=5)
        
        # Tokenization rules frame
        token_frame = ttk.LabelFrame(right_pane, text="Tokenization Rules")
        right_pane.add(token_frame, weight=1)
        self.token_rules_text = scrolledtext.ScrolledText(token_frame, height=5)
        self.token_rules_text.pack(fill="both", expand=True, padx=5, pady=5)
        ttk.Button(token_frame, text="Apply Rules", command=self.apply_token_rules).pack(pady=5)
        
        # Standards list
        standards_frame = ttk.Labelframe(right_pane, text="Available Standard Terms")
        right_pane.add(standards_frame, weight=3)
        self.standards_listbox = tk.Listbox(standards_frame)
        sl_vsb = ttk.Scrollbar(standards_frame, orient="vertical", command=self.standards_listbox.yview)
        self.standards_listbox.config(yscrollcommand=sl_vsb.set)
        sl_vsb.pack(side=tk.RIGHT, fill=tk.Y)
        self.standards_listbox.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.standards_listbox.bind("<<ListboxSelect>>", self.on_standard_term_select)
        self.populate_standards_list()
        
        # Make panels resizable
        self.make_resizable_panels()

    def create_dashboard(self, parent):
        """Create dashboard with visual metrics"""
        # Create matplotlib figure for charts
        self.fig = Figure(figsize=(10, 8), dpi=80)
        
        # Create subplots
        self.ax1 = self.fig.add_subplot(221)  # Pie chart
        self.ax2 = self.fig.add_subplot(222)  # Bar chart
        self.ax3 = self.fig.add_subplot(223)  # Line chart
        self.ax4 = self.fig.add_subplot(224)  # Statistics
        
        canvas = FigureCanvasTkAgg(self.fig, master=parent)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # Control frame
        control_frame = ttk.Frame(parent)
        control_frame.pack(fill=tk.X, pady=5)
        ttk.Button(control_frame, text="Refresh Dashboard", command=self.update_dashboard).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Export Chart", command=self.export_chart).pack(side=tk.LEFT, padx=5)
        
        # Initial update
        self.update_dashboard()

    def create_validation_tab(self, parent):
        """Create validation tab with quality assurance tools"""
        # Validation controls
        control_frame = ttk.LabelFrame(parent, text="Validation Controls")
        control_frame.pack(fill=tk.X, padx=10, pady=10)
        
        button_frame = ttk.Frame(control_frame)
        button_frame.pack(fill=tk.X, padx=5, pady=5)
        ttk.Button(button_frame, text="Validate Rules", command=self.validate_rules).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Check Conflicts", command=self.check_conflicts).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Run Quality Report", command=self.run_quality_report).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="View Audit Log", command=self.view_audit_log).pack(side=tk.LEFT, padx=5)
        
        # Validation results
        results_frame = ttk.LabelFrame(parent, text="Validation Results")
        results_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.validation_tree = ttk.Treeview(results_frame, columns=("Type", "Status", "Details"), show="headings")
        self.validation_tree.heading("Type", text="Type")
        self.validation_tree.heading("Status", text="Status")
        self.validation_tree.heading("Details", text="Details")
        self.validation_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

    def make_resizable_panels(self):
        """Make UI panels resizable"""
        # Set initial sash position
        self.main_pane.sashpos(0, 800)
        
        # Bind events to save panel positions
        self.main_pane.bind('<ButtonRelease-1>', self.save_panel_positions)

    def save_panel_positions(self, event=None):
        """Save current panel positions to profile"""
        if hasattr(self, 'main_pane'):
            positions = []
            try:
                pos = self.main_pane.sashpos(0)
                positions.append(pos)
            except:
                pass
            
            # Save to profile
            if hasattr(self, 'current_profile'):
                self.current_profile['panel_positions'] = positions

    def update_dashboard(self):
        """Update dashboard charts with current data"""
        if not self.cursor:
            return

        # Check if table exists
        if not self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='processed_courses'").fetchone():
            return
        
        # Clear all axes
        self.ax1.clear()
        self.ax2.clear()
        self.ax3.clear()
        self.ax4.clear()
        
        # Get statistics
        total = self.cursor.execute("SELECT COUNT(*) FROM processed_courses").fetchone()[0]
        auto = self.cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE status='Auto-Matched'").fetchone()[0]
        possible = self.cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE status='Possible Match'").fetchone()[0]
        dnm = total - auto - possible
        
        # Pie chart - Match distribution
        labels = ['Auto-Matched', 'Possible Match', 'Did Not Match']
        sizes = [auto, possible, dnm]
        colors = ['#4CAF50', '#FFC107', '#F44336']
        self.ax1.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        self.ax1.set_title('Match Distribution')
        
        # Bar chart - Score distribution
        scores = self.cursor.execute("SELECT score FROM processed_courses").fetchall()
        if scores:
            score_ranges = {"50-60": 0, "60-70": 0, "70-80": 0, "80-90": 0, "90-100": 0}
            for score in scores:
                s = score[0]
                if 50 <= s < 60: score_ranges["50-60"] += 1
                elif 60 <= s < 70: score_ranges["60-70"] += 1
                elif 70 <= s < 80: score_ranges["70-80"] += 1
                elif 80 <= s < 90: score_ranges["80-90"] += 1
                elif 90 <= s <= 100: score_ranges["90-100"] += 1
            
            self.ax2.bar(score_ranges.keys(), score_ranges.values(), color=['#F44336', '#FF9800', '#FFC107', '#8BC34A', '#4CAF50'])
            self.ax2.set_title('Score Distribution')
            self.ax2.set_xlabel('Score Range')
            self.ax2.set_ylabel('Count')
        
        # Line chart - Processing trend (mock data for now)
        dates = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']
        processed = [100, 250, 400, 350, 500]
        self.ax3.plot(dates, processed, marker='o', linestyle='-', color='#2196F3')
        self.ax3.set_title('Processing Trend')
        self.ax3.set_xlabel('Date')
        self.ax3.set_ylabel('Records Processed')
        
        # Statistics text
        stats_text = f"""Total Records: {total}
Auto-Matched: {auto} ({auto/total*100:.1f}%)
Possible Match: {possible} ({possible/total*100:.1f}%)
Did Not Match: {dnm} ({dnm/total*100:.1f}%)
Average Score: {sum(s[0] for s in scores)/len(scores):.1f} if scores else 0"""
        
        self.ax4.text(0.1, 0.5, stats_text, transform=self.ax4.transAxes, fontsize=12, verticalalignment='center')
        self.ax4.set_title('Statistics Summary')
        self.ax4.axis('off')
        
        # Redraw canvas
        self.fig.canvas.draw()

    def export_chart(self):
        """Export dashboard chart as image"""
        from matplotlib.backends.backend_pdf import PdfPages
        
        file_path = filedialog.asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF files", "*.pdf"), ("PNG files", "*.png")]
        )
        
        if file_path:
            if file_path.endswith('.pdf'):
                with PdfPages(file_path) as pdf:
                    pdf.savefig(self.fig)
            else:
                self.fig.savefig(file_path)
            
            messagebox.showinfo("Export Complete", f"Chart exported to {file_path}")

    def setup_semantic_matching(self):
        """Initialize semantic matching using sentence transformers"""
        try:
            from sentence_transformers import SentenceTransformer
            self.semantic_model = SentenceTransformer('all-MiniLM-L6-v2')
            self.semantic_enabled = True
        except ImportError:
            self.semantic_enabled = False
            messagebox.showinfo("Semantic Matching", 
                "sentence-transformers not installed. Semantic matching disabled.\n"
                "Install with: pip install sentence-transformers")

    def toggle_semantic_matching(self):
        """Toggle semantic matching on/off"""
        if not self.semantic_enabled:
            messagebox.showinfo("Not Available", "Semantic matching is not available. Please install sentence-transformers.")
            return
        
        # Toggle would go here - for now just show status
        status = "enabled" if self.semantic_enabled else "disabled"
        messagebox.showinfo("Semantic Matching", f"Semantic matching is {status}")

    def setup_active_learning(self):
        """Initialize active learning components"""
        self.uncertain_threshold = 75
        self.feedback_data = []

    def identify_uncertain_matches(self):
        """Identify matches that are uncertain and could benefit from user feedback"""
        if not self.cursor:
            return []
        
        uncertain = self.cursor.execute("""
            SELECT id, original, suggested, score 
            FROM processed_courses 
            WHERE score BETWEEN ? AND ? 
            AND final = ''
            LIMIT 10
        """, (self.possible_threshold.get(), self.uncertain_threshold)).fetchall()
        
        return uncertain

    def collect_feedback(self):
        """Collect user feedback on uncertain matches"""
        uncertain_matches = self.identify_uncertain_matches()
        if not uncertain_matches:
            messagebox.showinfo("No Uncertain Matches", "All matches are confident")
            return
        
        FeedbackWindow(self, uncertain_matches)

    def process_feedback(self, record_id, feedback):
        """Process user feedback to improve the model"""
        if feedback == "accept":
            # Strengthen this type of match
            self.cursor.execute("UPDATE processed_courses SET final = suggested WHERE id = ?", (record_id,))
            self.log_action("Feedback Accepted", {"record_id": record_id})
        elif feedback == "reject":
            # Weaken this type of match - add to ignore list
            original = self.cursor.execute("SELECT original FROM processed_courses WHERE id = ?", (record_id,)).fetchone()[0]
            self.ignore_list.add(original)
            self.log_action("Feedback Rejected", {"record_id": record_id, "original": original})
        elif feedback == "modify":
            # Ask for correct value and add to error map
            original = self.cursor.execute("SELECT original FROM processed_courses WHERE id = ?", (record_id,)).fetchone()[0]
            correct = simpledialog.askstring("Modify Match", f"Enter correct value for:\n{original}")
            if correct:
                self.error_map[original] = correct.strip().upper()
                self.save_error_map()
                self.log_action("Feedback Modified", {"record_id": record_id, "original": original, "correct": correct})
        
        self.conn.commit()

    def semantic_match(self, query, choices, threshold=0.7):
        """Perform semantic matching using embeddings"""
        if not self.semantic_enabled:
            return None, 0
        
        try:
            # Encode query and choices
            query_embedding = self.semantic_model.encode([query])
            choice_embeddings = self.semantic_model.encode(choices)
            
            # Calculate similarities
            similarities = cosine_similarity(query_embedding, choice_embeddings)[0]
            
            # Find best match
            best_idx = similarities.argmax()
            best_score = similarities[best_idx]
            
            if best_score >= threshold:
                return choices[best_idx], best_score
            return None, 0
        except Exception as e:
            print(f"Semantic matching error: {e}")
            return None, 0

    def enhanced_matching(self, text):
        """Combine fuzzy and semantic matching"""
        # First try fuzzy matching
        fuzzy_match, fuzzy_score, _ = process.extractOne(
            text, self.standard_terms, scorer=fuzz.WRatio
        )
        
        # If fuzzy score is low, try semantic matching
        if fuzzy_score < self.auto_threshold.get() and self.semantic_enabled:
            semantic_match, semantic_score = self.semantic_match(text, self.standard_terms)
            if semantic_match and semantic_score > 0.7:
                return semantic_match, int(semantic_score * 100)
        
        return fuzzy_match, fuzzy_score

    def preprocess_advanced(self, text):
        """Enhanced preprocessing with lemmatization"""
        try:
            # Tokenize and lemmatize
            tokens = word_tokenize(text.lower())
            lemmatizer = WordNetLemmatizer()
            lemmatized = [lemmatizer.lemmatize(token) for token in tokens]
            return ' '.join(lemmatized)
        except:
            return text

    def apply_token_rules(self):
        """Apply custom tokenization rules"""
        rules_text = self.token_rules_text.get('1.0', 'end-1c')
        rules = [line.strip() for line in rules_text.split('\n') if line.strip()]
        
        if not rules:
            messagebox.showwarning("No Rules", "Please enter tokenization rules")
            return
        
        # Apply rules to current data
        for rule in rules:
            # Simple rule format: "pattern -> replacement"
            if '->' in rule:
                pattern, replacement = rule.split('->', 1)
                pattern = pattern.strip()
                replacement = replacement.strip()
                
                # Apply to error map
                self.error_map[pattern] = replacement
        
        self.save_error_map()
        messagebox.showinfo("Rules Applied", f"Applied {len(rules)} tokenization rules")
        self.log_action("Token Rules Applied", {"rules_count": len(rules)})

    def validate_rules(self):
        """Validate standardization rules against test data"""
        if not self.standard_terms or not self.error_map:
            messagebox.showwarning("No Rules", "Please load standard terms and error map first")
            return
        
        # Create test cases
        test_cases = [
            ("MBBS", "MBBS"),
            ("MD IN GENERAL MEDICINE", "MD IN GENERAL MEDICINE"),
            ("M.D. GENERAL MEDICINE", "MD IN GENERAL MEDICINE"),
            ("BACHELOR OF DENTAL SURGERY", "BDS"),
            ("DIPLOMA IN ANESTHESIA", "DIPLOMA IN ANESTHESIA")
        ]
        
        results = []
        for original, expected in test_cases:
            processed = self.preprocess_string(original)
            corrected = self.apply_corrections(processed)
            match, score, _ = process.extractOne(corrected, self.standard_terms, scorer=fuzz.WRatio)
            passed = match == expected and score >= self.auto_threshold.get()
            results.append((original, expected, match, score, passed))
        
        # Show results
        ValidationWindow(self, results)
        
        # Update validation tab
        self.update_validation_tree("Rule Validation", "Completed", f"Tested {len(test_cases)} cases")
        
        self.log_action("Rule Validation", {"test_cases": len(test_cases), "passed": sum(1 for r in results if r[4])})

    def check_conflicts(self):
        """Check for conflicting mappings in error map"""
        conflicts = []
        corrections = {}
        
        for error, correction in self.error_map.items():
            if correction in corrections:
                conflicts.append((error, correction, corrections[correction]))
            else:
                corrections[correction] = error
        
        if conflicts:
            conflict_text = "\n".join([f"'{e1}' -> '{c}' conflicts with '{e2}' -> '{c}'" for e1, c, e2 in conflicts])
            messagebox.showwarning("Conflicts Found", f"Found {len(conflicts)} conflicts:\n\n{conflict_text}")
            self.update_validation_tree("Conflict Check", "Failed", f"Found {len(conflicts)} conflicts")
        else:
            messagebox.showinfo("No Conflicts", "No conflicts found in error map")
            self.update_validation_tree("Conflict Check", "Passed", "No conflicts found")
        
        self.log_action("Conflict Check", {"conflicts": len(conflicts)})

    def run_quality_report(self):
        """Generate a comprehensive quality report"""
        if not self.cursor:
            messagebox.showwarning("No Data", "Please load data first")
            return
        
        # Calculate quality metrics
        total = self.cursor.execute("SELECT COUNT(*) FROM processed_courses").fetchone()[0]
        auto = self.cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE status='Auto-Matched'").fetchone()[0]
        possible = self.cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE status='Possible Match'").fetchone()[0]
        dnm = total - auto - possible
        
        # Calculate average score
        avg_score = self.cursor.execute("SELECT AVG(score) FROM processed_courses").fetchone()[0] or 0
        
        # Quality score (0-100)
        quality_score = (auto / total * 100) if total > 0 else 0
        
        # Generate report
        report = f"""
Quality Report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
================================================

Summary:
- Total Records: {total}
- Auto-Matched: {auto} ({auto/total*100:.1f}%)
- Possible Match: {possible} ({possible/total*100:.1f}%)
- Did Not Match: {dnm} ({dnm/total*100:.1f}%)
- Average Score: {avg_score:.1f}
- Quality Score: {quality_score:.1f}/100

Recommendations:
"""
        
        if quality_score < 50:
            report += "- Quality score is low. Consider reviewing error map and standard terms.\n"
        elif quality_score < 75:
            report += "- Quality score is moderate. Some manual review may be needed.\n"
        else:
            report += "- Quality score is good. Minimal intervention required.\n"
        
        if dnm > total * 0.2:
            report += "- High number of unmatched records. Review standard terms.\n"
        
        if possible > total * 0.3:
            report += "- Many possible matches. Consider bulk apply or adjusting thresholds.\n"
        
        # Show report
        report_window = tk.Toplevel(self.root)
        report_window.title("Quality Report")
        report_window.geometry("600x500")
        
        text_widget = scrolledtext.ScrolledText(report_window, wrap=tk.WORD)
        text_widget.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        text_widget.insert('1.0', report)
        text_widget.config(state='disabled')
        
        ttk.Button(report_window, text="Close", command=report_window.destroy).pack(pady=10)
        
        self.update_validation_tree("Quality Report", "Completed", f"Score: {quality_score:.1f}/100")
        self.log_action("Quality Report", {"quality_score": quality_score, "total": total})

    def update_validation_tree(self, validation_type, status, details):
        """Update validation tree with new results"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        self.validation_tree.insert("", "end", values=(validation_type, status, f"{details} ({timestamp})"))

    def setup_audit_system(self):
        """Initialize audit trail system"""
        if self.conn:
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    user TEXT,
                    action TEXT,
                    details TEXT,
                    record_id TEXT
                )
            """)
            self.conn.commit()

    def log_action(self, action, details, record_id=None):
        """Log an action to the audit trail"""
        if self.cursor:
            self.cursor.execute("""
                INSERT INTO audit_log (user, action, details, record_id)
                VALUES (?, ?, ?, ?)
            """, (self.current_user, action, json.dumps(details), record_id))
            self.conn.commit()

    def view_audit_log(self):
        """Display audit log in a new window"""
        if not self.cursor:
            messagebox.showwarning("No Database", "Database not initialized")
            return
        
        log_window = tk.Toplevel(self.root)
        log_window.title("Audit Log")
        log_window.geometry("900x600")
        
        # Create treeview
        tree = ttk.Treeview(log_window, columns=("Timestamp", "User", "Action", "Details"), show="headings")
        tree.heading("Timestamp", text="Timestamp")
        tree.heading("User", text="User")
        tree.heading("Action", text="Action")
        tree.heading("Details", text="Details")
        
        # Add scrollbars
        vsb = ttk.Scrollbar(log_window, orient="vertical", command=tree.yview)
        hsb = ttk.Scrollbar(log_window, orient="horizontal", command=tree.xview)
        tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        
        # Pack widgets
        tree.pack(side="left", fill="both", expand=True, padx=(10, 0), pady=10)
        vsb.pack(side="right", fill="y", padx=(0, 10), pady=10)
        hsb.pack(side="bottom", fill="x", padx=10)
        
        # Populate with data
        for row in self.cursor.execute("SELECT timestamp, user, action, details FROM audit_log ORDER BY timestamp DESC LIMIT 1000"):
            tree.insert("", "end", values=row)
        
        ttk.Button(log_window, text="Close", command=log_window.destroy).pack(pady=10)

    @functools.lru_cache(maxsize=1000)
    def cached_extract_one(self, query, choices_tuple, scorer):
        """Cached version of rapidfuzz extractOne"""
        return process.extractOne(query, list(choices_tuple), scorer=scorer)

    def get_with_cache(self, key, func, *args, **kwargs):
        """Generic cache getter with TTL"""
        now = time.time()
        if key in self.cache:
            value, timestamp = self.cache[key]
            if now - timestamp < self.cache_ttl:
                return value
        
        result = func(*args, **kwargs)
        self.cache[key] = (result, now)
        return result

    def clear_cache(self):
        """Clear all caches"""
        self.cache.clear()
        self.cached_extract_one.cache_clear()

    def load_data_in_chunks(self, chunk_size=1000):
        """Load data in chunks for better performance"""
        if not self.cursor:
            return
        
        # Clear existing data
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        # Get total count
        total = self.cursor.execute("SELECT COUNT(*) FROM processed_courses").fetchone()[0]
        self.progress['maximum'] = total
        self.progress['value'] = 0
        
        # Load in chunks
        offset = 0
        while offset < total:
            query = f"SELECT id, file, original, suggested, score, status, final FROM processed_courses LIMIT {chunk_size} OFFSET {offset}"
            for row in self.cursor.execute(query):
                self.add_tree_item(row)
                self.progress['value'] += 1
            
            offset += chunk_size
            self.root.update_idletasks()
        
        self.progress['value'] = 0

    def add_tree_item(self, row):
        """Add a single item to the tree with proper tagging"""
        row_id, file, original, suggested, score, status, final = row
        tags = []
        
        if status == "Auto-Matched":
            tags.append('auto_status')
        elif status == "Possible Match":
            tags.append('possible_status')
        elif status == "Did Not Match":
            tags.append('dnm_status')
        
        if final:
            tags.append('final_changed')
        
        self.tree.insert("", "end", iid=row_id, values=(file, original, suggested, score, status, final), tags=tags)

    def create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Load File(s)...", command=self.load_files, accelerator="Ctrl+O")
        file_menu.add_command(label="Load Folder...", command=self.load_folder)
        file_menu.add_separator()
        file_menu.add_command(label="Save Session...", command=self.save_session, accelerator="Ctrl+S")
        file_menu.add_command(label="Load Session...", command=self.load_session)
        file_menu.add_separator()
        file_menu.add_command(label="Load Profile...", command=self.load_profile)
        file_menu.add_command(label="Save Profile As...", command=self.save_profile)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.on_closing)
        
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Edit", menu=edit_menu)
        edit_menu.add_command(label="Undo", command=self.undo, accelerator="Ctrl+Z")
        edit_menu.add_command(label="Redo", command=self.redo, accelerator="Ctrl+Y")
        edit_menu.add_separator()
        edit_menu.add_command(label="Find and Replace...", command=self.open_find_replace, accelerator="Ctrl+F")
        edit_menu.add_separator()
        edit_menu.add_command(label="Refresh Data with Current Settings", command=self.reprocess_data, accelerator="F5")
        edit_menu.add_command(label="Clear Cache", command=self.clear_cache)
        
        manage_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Manage", menu=manage_menu)
        manage_menu.add_command(label="Standard Courses...", command=self.manage_standards)
        manage_menu.add_command(label="Error Map...", command=self.manage_errors)
        
        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="View", menu=view_menu)
        view_menu.add_command(label="Toggle Dark Mode", command=sv_ttk.toggle_theme)
        view_menu.add_separator()
        view_menu.add_command(label="Data Processing", command=lambda: self.notebook.select(0))
        view_menu.add_command(label="Dashboard", command=lambda: self.notebook.select(1))
        view_menu.add_command(label="Validation", command=lambda: self.notebook.select(2))
        
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Tools", menu=tools_menu)
        tools_menu.add_command(label="Validate Rules", command=self.validate_rules)
        tools_menu.add_command(label="Check Conflicts", command=self.check_conflicts)
        tools_menu.add_command(label="Quality Report", command=self.run_quality_report)
        tools_menu.add_command(label="Collect Feedback", command=self.collect_feedback)
        tools_menu.add_separator()
        tools_menu.add_command(label="View Audit Log", command=self.view_audit_log)

    def bind_shortcuts(self):
        self.root.bind('<Control-o>', lambda e: self.load_files())
        self.root.bind('<Control-s>', lambda e: self.save_session())
        self.root.bind('<Control-z>', lambda e: self.undo())
        self.root.bind('<Control-y>', lambda e: self.redo())
        self.root.bind('<Control-f>', lambda e: self.open_find_replace())
        self.root.bind('<F5>', lambda e: self.reprocess_data())

    def schedule_search(self, event=None):
        if self.search_timer:
            self.root.after_cancel(self.search_timer)
        self.search_timer = self.root.after(300, self.refresh_tree)

    def on_tree_select(self, event=None):
        self.show_diff()
        if not self.tree.selection():
            return
        values = self.tree.item(self.tree.selection()[0], "values")
        self.quick_edit_original.set(values[1])
        self.quick_edit_correction.set(values[2])

    def quick_add_error(self):
        error = self.quick_edit_original.get().strip().upper()
        correction = self.quick_edit_correction.get().strip().upper()
        if not error or not correction:
            return messagebox.showwarning("Input Error", "Both fields are required.")
        if error in self.error_map and not messagebox.askyesno("Confirm Overwrite", f"'{error}' already exists. Overwrite?"):
            return
        self.error_map[error] = correction
        self.save_error_map()
        messagebox.showinfo("Success", f"'{error}' mapped to '{correction}'.\nRefresh data to apply changes.")
        self.log_action("Quick Add Error", {"error": error, "correction": correction})

    def quick_add_standard(self):
        new_term = self.quick_edit_correction.get().strip().upper()
        if not new_term:
            return messagebox.showwarning("Input Error", "Correction field cannot be empty.")
        if new_term in self.standard_terms:
            return messagebox.showwarning("Input Error", "This term already exists as a standard.")
        self.standard_terms.append(new_term)
        self.standard_terms.sort()
        self.save_standard_terms()
        self.populate_standards_list()
        self.log_action("Quick Add Standard", {"term": new_term})

    def save_error_map(self):
        try:
            df = pd.DataFrame(list(self.error_map.items()), columns=['Error', 'Correction'])
            df.to_excel(DEFAULT_ERRORS_FILE, index=False)
        except Exception as e:
            messagebox.showerror("Save Error", f"Could not save error map: {e}")

    def save_standard_terms(self):
        try:
            with open(DEFAULT_STANDARDS_FILE, "w", encoding="utf-8") as f:
                f.write("\n".join(self.standard_terms))
        except Exception as e:
            messagebox.showerror("Save Error", f"Could not save standard terms: {e}")
            
    def manage_standards(self):
        StandardsManagerWindow(self)
        
    def manage_errors(self):
        ErrorsManagerWindow(self)
        
    def open_find_replace(self):
        FindReplaceWindow(self)
    
    def setup_database(self, path: str = ":memory:"):
        if self.conn:
            self.conn.close()
        self.db_path = path
        self.conn = sqlite3.connect(path)
        self.cursor = self.conn.cursor()

    def on_closing(self):
        if self.conn:
            self.conn.close()
        self.root.destroy()

    def load_spacy_model(self):
        try:
            return spacy.load("en_core_web_sm")
        except OSError:
            messagebox.showwarning("AI Model Missing", "SpaCy model 'en_core_web_sm' not found.\nAI Assist will be disabled.")
            return None

    def clear_filters(self):
        self.search_var.set("")
        self.status_filter.set("All")
        self.refresh_tree()

    def on_standard_term_select(self, event=None):
        if not self.standards_listbox.curselection():
            return
        self.search_var.set(self.standards_listbox.get(self.standards_listbox.curselection()))

    def save_session(self):
        path = filedialog.asksaveasfilename(defaultextension=".db", filetypes=[("Database File", "*.db")])
        if not path:
            return
        metadata = {
            "table_info": self.table_info,
            "source_folder": self.source_folder,
            "last_used_course_column": self.last_used_course_column
        }
        self.cursor.execute("DROP TABLE IF EXISTS _metadata")
        self.cursor.execute("CREATE TABLE _metadata (key TEXT PRIMARY KEY, value TEXT)")
        self.cursor.execute("INSERT INTO _metadata VALUES (?, ?)", ('metadata', json.dumps(metadata)))
        self.conn.commit()
        backup_conn = sqlite3.connect(path)
        with backup_conn:
            self.conn.backup(backup_conn)
        backup_conn.close()
        self.db_path = path
        self.root.title(f"Course Standardizer v7.0 - [{os.path.basename(path)}]")
        messagebox.showinfo("Session Saved", f"Session saved to:\n{path}")
        self.log_action("Session Saved", {"path": path})

    def load_session(self):
        path = filedialog.askopenfilename(filetypes=[("Database File", "*.db")])
        if not path:
            return
        try:
            file_conn = sqlite3.connect(path)
            self.setup_database()
            with file_conn:
                file_conn.backup(self.conn)
            file_conn.close()
            self.cursor.execute("SELECT value FROM _metadata WHERE key='metadata'")
            meta_row = self.cursor.fetchone()
            if not meta_row:
                raise ValueError("Metadata not found.")
            metadata = json.loads(meta_row[0])
            self.table_info = metadata.get("table_info", {})
            self.source_folder = metadata.get("source_folder")
            self.last_used_course_column = metadata.get("last_used_course_column")
            self.db_path = path
            self.root.title(f"Course Standardizer v7.0 - [{os.path.basename(path)}]")
            self.refresh_tree()
            messagebox.showinfo("Session Loaded", "Session loaded successfully.")
            self.log_action("Session Loaded", {"path": path})
        except Exception as e:
            messagebox.showerror("Load Error", f"Failed to load session file.\nError: {e}")
            self.setup_database()

    def load_files(self):
        files = filedialog.askopenfilenames(filetypes=[('Data files', '*.xlsx *.xls *.csv')])
        if not files:
            return
        self.source_folder = os.path.dirname(files[0])
        self.process_files(list(files))

    def load_folder(self):
        folder = filedialog.askdirectory()
        if not folder:
            return
        self.source_folder = folder
        files = [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith((".xlsx", ".xls", ".csv"))]
        if not files:
            return messagebox.showinfo("No Files Found", "No compatible files found.")
        self.process_files(files)
    
    def process_files(self, file_paths: list):
        self.setup_database()
        self.setup_audit_system()  # Recreate audit_log table after DB reset
        self.table_info.clear()
        self.undo_stack.clear()
        self.redo_stack.clear()
        self.last_used_course_column = None
        self.progress["maximum"] = len(file_paths)
        self.progress["value"] = 0
        
        for idx, path in enumerate(file_paths, 1):
            try:
                file = os.path.basename(path)
                df = pd.read_csv(path) if file.endswith(".csv") else pd.read_excel(path, engine="openpyxl")
                df.columns = [re.sub(r'[^a-zA-Z0-9_]', '_', str(c)) for c in df.columns]
                df_upper_cols = {c.upper(): c for c in df.columns}
                course_col = None
                
                if self.last_used_course_column and self.last_used_course_column in df_upper_cols:
                    course_col = df_upper_cols[self.last_used_course_column]
                else:
                    possible_cols = ["COURSES", "COURSE", "COURSE_NAME", "SPECIALTY", "SUBJECT", "DISCIPLINE"]
                    found_col_upper = next((c for c in possible_cols if c in df_upper_cols), None)
                    if found_col_upper:
                        course_col = df_upper_cols[found_col_upper]
                
                if not course_col:
                    print(f"Warning: No course column in {file}. Skipping.")
                    continue
                    
                self.last_used_course_column = course_col.upper()
                df['__id__'] = [str(uuid.uuid4()) for _ in range(len(df))]
                df['__original_course__'] = df[course_col]
                sanitized_name = "file_" + re.sub(r'[^a-zA-Z0-9_]', '_', os.path.splitext(file)[0])
                self.table_info[sanitized_name] = {'original_name': file, 'course_col': course_col}
                df.to_sql(sanitized_name, self.conn, index=False, if_exists='replace')
            except Exception as e:
                messagebox.showerror("File Load Error", f"Could not process {os.path.basename(path)}\n\nError: {e}")
            self.progress["value"] = idx
            self.root.update_idletasks()
        
        self.process_loaded_data()
        self.refresh_tree()
        self.update_dashboard()
        self.log_action("Files Processed", {"count": len(file_paths), "source": self.source_folder})

    def process_loaded_data(self):
        self.cursor.execute("DROP TABLE IF EXISTS processed_courses")
        self.cursor.execute("""
            CREATE TABLE processed_courses (
                id TEXT PRIMARY KEY, 
                file TEXT, 
                original TEXT, 
                suggested TEXT,
                score INTEGER, 
                status TEXT, 
                final TEXT, 
                source_table TEXT, 
                source_id TEXT
            )
        """)
        rows = []
        
        for table, info in self.table_info.items():
            for row in self.cursor.execute(f'SELECT DISTINCT "{info["course_col"]}" FROM {table}').fetchall():
                course = row[0]
                if pd.isna(course):
                    continue
                raw = str(course).strip()
                if not raw or raw.upper() in self.ignore_list:
                    continue
                    
                processed = self.preprocess_string(raw)
                corrected = self.apply_corrections(processed)
                if corrected in self.ignore_list:
                    continue
                    
                # Use enhanced matching
                match, score = self.enhanced_matching(corrected)
                score = int(score or 0)
                match = match or ""
                status = self.classify_match(score)
                final = match if status == "Auto-Matched" else ""
                
                rows.append((
                    str(uuid.uuid4()), 
                    info['original_name'], 
                    corrected, 
                    match, 
                    score, 
                    status, 
                    final, 
                    table, 
                    corrected
                ))
        
        self.cursor.executemany("INSERT INTO processed_courses VALUES (?,?,?,?,?,?,?,?,?)", rows)
        self.conn.commit()

    def reprocess_data(self):
        if not self.cursor.execute("SELECT 1 FROM processed_courses LIMIT 1").fetchone():
            return messagebox.showinfo("No Data", "Please load data first.")
        
        updates = []
        for row_id, original in self.cursor.execute("SELECT id, original FROM processed_courses").fetchall():
            corrected = self.apply_corrections(original)
            match, score = self.enhanced_matching(corrected)
            score = int(score or 0)
            status = self.classify_match(score)
            old_status, old_final = self.cursor.execute("SELECT status, final FROM processed_courses WHERE id=?", (row_id,)).fetchone()
            final = match if status == "Auto-Matched" else (old_final if old_status != "Auto-Matched" else "")
            updates.append((match or "", score, status, final, row_id))
        
        self.cursor.executemany("UPDATE processed_courses SET suggested=?, score=?, status=?, final=? WHERE id=?", updates)
        self.conn.commit()
        self.refresh_tree()
        self.update_dashboard()
        messagebox.showinfo("Success", "Data has been re-processed.")
        self.log_action("Data Reprocessed", {"updates": len(updates)})

    def sort_treeview_column(self, col: str):
        if self.sort_column == col:
            self.sort_reverse = not self.sort_reverse
        else:
            self.sort_column, self.sort_reverse = col, False
        self.refresh_tree()

    def refresh_tree(self):
        for i in self.tree.get_children():
            self.tree.delete(i)
        
        query = "SELECT id, file, original, suggested, score, status, final FROM processed_courses"
        params, conditions = [], []
        
        if self.status_filter.get() != "All":
            conditions.append("status = ?")
            params.append(self.status_filter.get())
        
        if self.search_var.get():
            search = f"%{self.search_var.get().upper()}%"
            conditions.append("(original LIKE ? OR suggested LIKE ? OR final LIKE ?)")
            params.extend([search, search, search])
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        col_map = {
            "File": "file",
            "Original": "original",
            "Suggested": "suggested",
            "Score": "score",
            "Status": "status",
            "Final": "final"
        }
        query += f" ORDER BY {col_map.get(self.sort_column, 'file')} {'DESC' if self.sort_reverse else 'ASC'}"
        
        self.cursor.execute(query, params)
        for row in self.cursor.fetchall():
            tags = []
            status = row[5]
            if status == "Auto-Matched":
                tags.append('auto_status')
            elif status == "Possible Match":
                tags.append('possible_status')
            elif status == "Did Not Match":
                tags.append('dnm_status')
            if row[6]:
                tags.append('final_changed')
            self.tree.insert("", tk.END, iid=row[0], values=row[1:], tags=tags)
        
        total = self.cursor.execute("SELECT COUNT(*) FROM processed_courses").fetchone()[0]
        auto = self.cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE status='Auto-Matched'").fetchone()[0]
        possible = self.cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE status='Possible Match'").fetchone()[0]
        self.stats_var.set(f"Displaying: {len(self.tree.get_children())} of {total} | Auto: {auto} | Possible: {possible} | DNM: {total - auto - possible}")

    def load_default_profile(self):
        standards = set(EMBEDDED_STANDARD_TERMS)
        if os.path.exists(DEFAULT_STANDARDS_FILE):
            try:
                if DEFAULT_STANDARDS_FILE.endswith('.xlsx'):
                    df = pd.read_excel(DEFAULT_STANDARDS_FILE)
                    # Use first column for course names
                    col = df.columns[0]
                    standards.update([str(v).strip().upper() for v in df[col].dropna()])
                else:
                    with open(DEFAULT_STANDARDS_FILE, "r", encoding="utf-8") as f:
                        standards.update([l.strip().upper() for l in f if l.strip()])
            except Exception as e:
                messagebox.showerror("Error", f"Could not load {DEFAULT_STANDARDS_FILE}: {e}")
        
        self.standard_terms = sorted(list(standards))
        self.error_map = {}
        
        if os.path.exists(DEFAULT_ERRORS_FILE):
            try:
                df = pd.read_excel(DEFAULT_ERRORS_FILE)
                for _, row in df.iterrows():
                    self.error_map[str(row[0]).upper().strip()] = str(row[1]).upper().strip()
            except Exception as e:
                messagebox.showerror("Error", f"Could not load {DEFAULT_ERRORS_FILE}: {e}")

    def load_profile(self):
        path = filedialog.askopenfilename(filetypes=[("Profile JSON", "*.json")])
        if not path:
            return
        try:
            with open(path, "r") as f:
                data = json.load(f)
            self.auto_threshold.set(data.get("auto_threshold", 90))
            self.possible_threshold.set(data.get("possible_threshold", 70))
            self.ignore_list = set(data.get("ignore_list", []))
            self.ignore_brackets_var.set(data.get("ignore_brackets", False))
            
            # Load panel positions if available
            if 'panel_positions' in data and hasattr(self, 'main_pane'):
                try:
                    self.main_pane.sashpos(0, data['panel_positions'][0])
                except:
                    pass
            
            messagebox.showinfo("Profile Loaded", f"Profile loaded from\n{path}")
            self.log_action("Profile Loaded", {"path": path})
        except Exception as e:
            messagebox.showerror("Load Error", f"Failed to load profile: {e}")

    def save_profile(self):
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("Profile JSON", "*.json")])
        if not path:
            return
        try:
            data = {
                "auto_threshold": self.auto_threshold.get(),
                "possible_threshold": self.possible_threshold.get(),
                "ignore_list": sorted(list(self.ignore_list)),
                "ignore_brackets": self.ignore_brackets_var.get()
            }
            
            # Save panel positions
            if hasattr(self, 'main_pane'):
                try:
                    pos = self.main_pane.sashpos(0)
                    data['panel_positions'] = [pos]
                except:
                    pass
            
            with open(path, "w") as f:
                json.dump(data, f, indent=4)
            messagebox.showinfo("Profile Saved", f"Profile saved to\n{path}")
            self.log_action("Profile Saved", {"path": path})
        except Exception as e:
            messagebox.showerror("Save Error", f"Failed to save profile: {e}")

    def populate_standards_list(self):
        self.standards_listbox.delete(0, tk.END)
        for term in self.standard_terms:
            self.standards_listbox.insert(tk.END, term)

    def edit_cell(self, event):
        row_id = self.tree.identify_row(event.y)
        if not row_id:
            return
        col_id_str = self.tree.identify_column(event.x)
        col_idx = int(col_id_str.replace('#', ''))
        if col_idx not in [3, 6]:
            return
        x, y, w, h = self.tree.bbox(row_id, col_id_str)
        combo = ttk.Combobox(self.root, values=self.standard_terms)
        combo.place(x=x + self.tree.winfo_x(), y=y + self.tree.winfo_y(), width=w, height=h)
        combo.set(self.tree.item(row_id, "values")[col_idx-1])
        combo.focus_set()
        combo.bind('<<ComboboxSelected>>', lambda e: self.save_combo(row_id, col_idx, combo))
        combo.bind('<FocusOut>', lambda e: combo.destroy())

    def save_combo(self, row_id, col_index, combo):
        new_val = combo.get().strip().upper()
        old_val = self.tree.item(row_id, "values")[col_index-1]
        combo.destroy()
        if old_val != new_val:
            self.apply_changes([{'id': row_id, 'col': col_index, 'old': old_val, 'new': new_val}], "Edit Cell")

    def show_context_menu(self, event):
        if not self.tree.selection():
            return
        menu = tk.Menu(self.root, tearoff=0)
        menu.add_command(label="Apply Suggestion to Final", command=self.apply_suggestion_context)
        menu.add_separator()
        menu.add_command(label="Add to Error Map...", command=self.add_to_error_map_context)
        menu.add_command(label="Add Original to Ignore List", command=self.add_to_ignore_list_context)
        menu.post(event.x_root, event.y_root)

    def apply_suggestion_context(self):
        changes = []
        for iid in self.tree.selection():
            vals = self.tree.item(iid, "values")
            suggested_val, final_val = vals[2], vals[5]
            if suggested_val and suggested_val != final_val:
                changes.append({'id': iid, 'col': 6, 'old': final_val, 'new': suggested_val})
        if changes:
            self.apply_changes(changes, "Apply Suggestion")
    
    def add_to_ignore_list_context(self):
        terms = {self.tree.item(iid, "values")[1] for iid in self.tree.selection()}
        if terms:
            self.ignore_list.update(terms)
            self.cursor.execute(f"DELETE FROM processed_courses WHERE original IN ({','.join('?'*len(terms))})", list(terms))
            self.conn.commit()
            messagebox.showinfo("Ignore List", f"{len(terms)} term(s) added and removed.")
            self.refresh_tree()
            self.log_action("Added to Ignore List", {"terms": list(terms)})

    def add_to_error_map_context(self):
        if len(self.tree.selection()) != 1:
            return messagebox.showwarning("Selection Error", "Select one row.")
        original = self.tree.item(self.tree.selection()[0], "values")[1]
        correct = simpledialog.askstring("Add Correction", f"Standard term for:\n'{original}'")
        if correct:
            self.error_map[original] = correct.strip().upper()
            self.save_error_map()
            messagebox.showinfo("Success", f"Mapped '{original}' to '{correct}'.\nRefresh data to apply.")
            self.log_action("Added to Error Map", {"original": original, "correction": correct})

    def push_to_undo(self, action):
        self.undo_stack.append(action)
        self.redo_stack.clear()

    def undo(self):
        if not self.undo_stack:
            return
        action = self.undo_stack.pop()
        self.redo_stack.append(action)
        self.apply_changes([{'id': c['id'], 'col': c['col'], 'old': c['new'], 'new': c['old']} for c in action['changes']], "Undo", True)

    def redo(self):
        if not self.redo_stack:
            return
        action = self.redo_stack.pop()
        self.undo_stack.append(action)
        self.apply_changes(action['changes'], "Redo", True)

    def apply_changes(self, changes: list, description: str, is_undo_redo: bool = False):
        if not is_undo_redo:
            self.push_to_undo({'description': description, 'changes': changes})
        col_map = {3: "suggested", 6: "final"}
        for change in changes:
            if change['col'] in col_map:
                self.cursor.execute(f"UPDATE processed_courses SET {col_map[change['col']]}=? WHERE id=?", (change['new'], change['id']))
        self.conn.commit()
        self.refresh_tree()
        self.show_diff()
        self.log_action(description, {"changes": len(changes)})

    def bulk_apply_possible(self):
        if not messagebox.askyesno("Confirm", "Apply all 'Possible Match' suggestions?"):
            return
        self.cursor.execute("SELECT id, final, suggested FROM processed_courses WHERE status='Possible Match' AND suggested != ''")
        changes = [{'id': r[0], 'col': 6, 'old': r[1], 'new': r[2]} for r in self.cursor.fetchall()]
        if changes:
            self.push_to_undo({'description': "Bulk Apply Possible", 'changes': changes})
            self.cursor.execute("UPDATE processed_courses SET final = suggested WHERE status='Possible Match' AND suggested != ''")
            self.conn.commit()
            self.refresh_tree()
            self.update_dashboard()
            self.log_action("Bulk Apply Possible", {"changes": len(changes)})

    def save_reports(self):
        if not self.cursor.execute("SELECT 1 FROM processed_courses LIMIT 1").fetchone():
            return messagebox.showwarning("No Data", "No data to save.")
        folder = filedialog.askdirectory()
        if not folder:
            return
        try:
            df = pd.read_sql_query("SELECT file, original, suggested, score, status, final FROM processed_courses", self.conn)
            df.to_csv(os.path.join(folder, "complete_match_report.csv"), index=False)
            messagebox.showinfo("Save Successful", f"Reports saved to:\n{folder}")
            self.log_action("Reports Saved", {"folder": folder})
        except Exception as e:
            messagebox.showerror("Save Error", f"An error occurred: {e}")

    def export_corrected_files(self):
        if not self.source_folder or not self.table_info:
            return messagebox.showwarning("No Data", "Load data first.")
        output_folder = filedialog.askdirectory()
        if not output_folder:
            return
        self.progress['maximum'] = len(self.table_info)
        correction_map = dict(self.cursor.execute("SELECT original, final FROM processed_courses WHERE final != ''").fetchall())
        
        for i, (table_name, info) in enumerate(self.table_info.items()):
            try:
                df = pd.read_sql_query(f"SELECT * FROM {table_name}", self.conn)
                def get_final(val):
                    if pd.isna(val):
                        return val
                    key = self.apply_corrections(self.preprocess_string(str(val)))
                    return correction_map.get(key, val)
                df[info['course_col']] = df['__original_course__'].apply(get_final)
                df.drop(columns=['__id__', '__original_course__'], inplace=True)
                base, ext = os.path.splitext(info['original_name'])
                path = os.path.join(output_folder, f"{base}_CLEANED{ext}")
                if ext == '.csv':
                    df.to_csv(path, index=False)
                else:
                    df.to_excel(path, index=False)
            except Exception as e:
                messagebox.showerror("Export Error", f"Failed on {info['original_name']}.\nError: {e}")
            self.progress['value'] = i + 1
            self.root.update_idletasks()
        
        messagebox.showinfo("Export Complete", f"Files exported to:\n{output_folder}")
        self.log_action("Files Exported", {"folder": output_folder, "count": len(self.table_info)})

    def run_ai_assist(self):
        if not self.nlp:
            messagebox.showwarning("AI Not Available", "AI model not loaded. Please install spaCy and en_core_web_sm model.")
            return
        
        if not self.tree.selection():
            messagebox.showinfo("No Selection", "Please select a course name to analyze.")
            return
        
        selected = self.tree.selection()[0]
        values = self.tree.item(selected, "values")
        original = values[1]
        
        doc = self.nlp(original)
        entities = [(ent.text, ent.label_) for ent in doc.ents]
        
        # Find similar courses
        similar = []
        for std in self.standard_terms:
            score = fuzz.ratio(original.upper(), std.upper())
            if score > 60:
                similar.append((std, score))
        similar.sort(key=lambda x: x[1], reverse=True)
        
        # Show AI suggestions
        ai_window = tk.Toplevel(self.root)
        ai_window.title("AI Assist")
        ai_window.geometry("500x400")
        
        ttk.Label(ai_window, text=f"Analyzing: {original}", font=("Segoe UI", 10, "bold")).pack(pady=10)
        
        if entities:
            ttk.Label(ai_window, text="Detected Entities:", font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=10)
            for ent, label in entities:
                ttk.Label(ai_window, text=f"  • {ent} ({label})").pack(anchor="w", padx=20)
        
        if similar:
            ttk.Label(ai_window, text="Similar Standard Terms:", font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=10, pady=(10, 0))
            for term, score in similar[:5]:
                ttk.Label(ai_window, text=f"  • {term} ({score}%)").pack(anchor="w", padx=20)
        
        ttk.Button(ai_window, text="Close", command=ai_window.destroy).pack(pady=20)
        
        self.log_action("AI Assist", {"original": original, "entities": len(entities), "similar": len(similar)})

    def preprocess_string(self, text):
        """Preprocess course name string"""
        if not text:
            return ""
        
        # Convert to uppercase and strip
        text = str(text).upper().strip()
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Handle brackets if option is selected
        if self.ignore_brackets_var.get():
            text = re.sub(r'[\(\[\{].*?[\)\]\}]', '', text)
        
        # Remove special characters but keep spaces
        text = re.sub(r'[^A-Z0-9\s]', ' ', text)
        
        # Remove extra spaces again
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text

    def apply_corrections(self, text):
        """Apply error corrections to text"""
        if not text:
            return text
        
        corrected = text
        for error, correction in self.error_map.items():
            if error in corrected:
                corrected = corrected.replace(error, correction)
        
        return corrected

    def classify_match(self, score):
        """Classify match based on score"""
        if score >= self.auto_threshold.get():
            return "Auto-Matched"
        elif score >= self.possible_threshold.get():
            return "Possible Match"
        else:
            return "Did Not Match"

    def show_diff(self):
        """Show difference between original and corrected text"""
        if not self.tree.selection():
            self.diff_text.config(state='normal')
            self.diff_text.delete('1.0', 'end')
            self.diff_text.config(state='disabled')
            return
        
        values = self.tree.item(self.tree.selection()[0], "values")
        original = values[1]
        suggested = values[2]
        final = values[5] if values[5] else suggested
        
        # Generate diff
        diff = list(difflib.ndiff(original.split(), final.split()))
        
        self.diff_text.config(state='normal')
        self.diff_text.delete('1.0', 'end')
        
        for word in diff:
            if word.startswith('+ '):
                self.diff_text.insert('end', word[2:] + ' ', 'added')
            elif word.startswith('- '):
                self.diff_text.insert('end', word[2:] + ' ', 'removed')
            elif word.startswith('  '):
                self.diff_text.insert('end', word[2:] + ' ')
        
        self.diff_text.config(state='disabled')

if __name__ == "__main__":
    root = tk.Tk()
    app = CourseCleanerApp(root)
    root.mainloop()