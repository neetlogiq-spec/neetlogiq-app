import tkinter as tk
from tkinter import ttk, messagebox

class StandardsManagerWindow(tk.Toplevel):
    def __init__(self, parent, processor):
        super().__init__(parent)
        self.processor = processor
        self.title("Manage Standard Courses")
        self.geometry("600x400")
        self.transient(parent)
        self.grab_set()
        
        self.temp_standards = self.processor.standard_terms.copy()
        
        self.setup_ui()

    def setup_ui(self):
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

    def populate_list(self):
        self.listbox.delete(0, tk.END)
        for term in sorted(self.temp_standards):
            self.listbox.insert(tk.END, term)
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
        self.processor.save_standards(self.temp_standards)
        messagebox.showinfo("Success", "Standard courses saved.", parent=self)
        self.destroy()

class ErrorsManagerWindow(tk.Toplevel):
    def __init__(self, parent, processor):
        super().__init__(parent)
        self.processor = processor
        self.title("Manage Error Map")
        self.geometry("800x500")
        self.transient(parent)
        self.grab_set()
        
        self.temp_error_map = self.processor.error_map.copy()
        
        self.setup_ui()

    def setup_ui(self):
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        tree_frame = ttk.Frame(frame)
        tree_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        columns = ("Error", "Correction")
        self.tree = ttk.Treeview(tree_frame, columns=columns, show="headings")
        self.tree.heading("Error", text="Error Term")
        self.tree.heading("Correction", text="Corrected Term")
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.config(yscrollcommand=scrollbar.set)
        self.tree.bind("<<TreeviewSelect>>", self.on_select)
        
        entry_frame = ttk.Labelframe(frame, text="Edit Entry")
        entry_frame.pack(fill=tk.X, pady=5)
        entry_frame.columnconfigure(1, weight=1)
        
        ttk.Label(entry_frame, text="Error:").grid(row=0, column=0, padx=5, pady=2, sticky='w')
        self.error_var = tk.StringVar()
        ttk.Entry(entry_frame, textvariable=self.error_var).grid(row=0, column=1, padx=5, pady=2, sticky='ew')
        
        ttk.Label(entry_frame, text="Correction:").grid(row=1, column=0, padx=5, pady=2, sticky='w')
        self.correction_var = tk.StringVar()
        ttk.Entry(entry_frame, textvariable=self.correction_var).grid(row=1, column=1, padx=5, pady=2, sticky='ew')
        
        action_frame = ttk.Frame(frame)
        action_frame.pack(fill=tk.X, pady=5)
        ttk.Button(action_frame, text="Add", command=self.add_entry).pack(side=tk.LEFT, padx=5)
        self.update_button = ttk.Button(action_frame, text="Update", command=self.update_entry, state="disabled")
        self.update_button.pack(side=tk.LEFT, padx=5)
        self.delete_button = ttk.Button(action_frame, text="Delete", command=self.delete_entry, state="disabled")
        self.delete_button.pack(side=tk.LEFT, padx=5)
        
        bottom_frame = ttk.Frame(frame)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=(10, 0))
        ttk.Button(bottom_frame, text="Save and Close", command=self.save).pack(side=tk.RIGHT)
        ttk.Button(bottom_frame, text="Cancel", command=self.destroy).pack(side=tk.RIGHT, padx=10)
        
        self.populate_tree()

    def populate_tree(self):
        self.tree.delete(*self.tree.get_children())
        for error, correction in sorted(self.temp_error_map.items()):
            self.tree.insert("", tk.END, values=(error, correction))
        self.error_var.set("")
        self.correction_var.set("")
        self.update_button.config(state="disabled")
        self.delete_button.config(state="disabled")

    def on_select(self, event=None):
        if not self.tree.selection(): return
        values = self.tree.item(self.tree.selection()[0], 'values')
        self.error_var.set(values[0])
        self.correction_var.set(values[1])
        self.update_button.config(state="normal")
        self.delete_button.config(state="normal")

    def add_entry(self):
        error = self.error_var.get().strip().upper()
        correction = self.correction_var.get().strip().upper()
        if not error or not correction: return messagebox.showwarning("Input Error", "Both fields are required.", parent=self)
        if error in self.temp_error_map: return messagebox.showwarning("Input Error", "This error term already exists.", parent=self)
        self.temp_error_map[error] = correction
        self.populate_tree()

    def update_entry(self):
        if not self.tree.selection(): return
        error = self.error_var.get().strip().upper()
        correction = self.correction_var.get().strip().upper()
        original_key = self.tree.item(self.tree.selection()[0], 'values')[0]
        
        if not error or not correction: return messagebox.showwarning("Input Error", "Both fields are required.", parent=self)
        
        if error != original_key:
            if messagebox.askyesno("Confirm Key Change", "Create new entry and delete old one?", parent=self):
                del self.temp_error_map[original_key]
            else:
                return
        
        self.temp_error_map[error] = correction
        self.populate_tree()

    def delete_entry(self):
        if not self.tree.selection(): return
        error_term = self.tree.item(self.tree.selection()[0], 'values')[0]
        if messagebox.askyesno("Confirm Delete", f"Delete mapping for '{error_term}'?", parent=self):
            del self.temp_error_map[error_term]
            self.populate_tree()

    def save(self):
        self.processor.save_error_map(self.temp_error_map)
        messagebox.showinfo("Success", "Error map saved.", parent=self)
        self.destroy()
