import tkinter as tk
from tkinter import ttk

class CommandPalette(tk.Toplevel):
    """Quick action command palette (Ctrl+K)"""
    
    def __init__(self, parent, commands):
        super().__init__(parent)
        self.commands = commands  # dict: "Command Name" -> function
        self.filtered_commands = list(commands.keys())
        
        self.overrideredirect(True)
        self.configure(bg="#2d2d2d")
        
        # Center on parent
        w, h = 600, 400
        x = parent.winfo_rootx() + (parent.winfo_width() // 2) - (w // 2)
        y = parent.winfo_rooty() + (parent.winfo_height() // 4)
        self.geometry(f"{w}x{h}+{x}+{y}")
        
        self.setup_ui()
        self.search_entry.focus_set()
        
        # Bindings
        self.bind("<Escape>", lambda e: self.destroy())
        self.bind("<FocusOut>", lambda e: self.destroy())
        self.search_entry.bind("<KeyRelease>", self.filter_commands)
        self.search_entry.bind("<Down>", self.move_select_down)
        self.search_entry.bind("<Up>", self.move_select_up)
        self.search_entry.bind("<Return>", self.execute_command)
        self.listbox.bind("<Double-Button-1>", self.execute_command)
        
    def setup_ui(self):
        # Search
        search_frame = tk.Frame(self, bg="#2d2d2d", pady=10, padx=10)
        search_frame.pack(fill=tk.X)
        
        tk.Label(search_frame, text="🔍", bg="#2d2d2d", fg="#888", font=("Arial", 14)).pack(side=tk.LEFT, padx=5)
        
        self.search_entry = tk.Entry(search_frame, bg="#2d2d2d", fg="white", 
                                    insertbackground="white", relief="flat",
                                    font=("Segoe UI", 14))
        self.search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        tk.Frame(self, bg="#444", height=1).pack(fill=tk.X)
        
        # List
        self.listbox = tk.Listbox(self, bg="#2d2d2d", fg="#ddd", 
                                 selectbackground="#2196F3", selectforeground="white",
                                 relief="flat", font=("Segoe UI", 12),
                                 highlightthickness=0, activestyle="none")
        self.listbox.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.update_list()
        
    def filter_commands(self, event):
        if event.keysym in ('Up', 'Down', 'Return'): return
        
        query = self.search_entry.get().lower()
        self.filtered_commands = [cmd for cmd in self.commands.keys() if query in cmd.lower()]
        self.update_list()
        
    def update_list(self):
        self.listbox.delete(0, tk.END)
        for cmd in self.filtered_commands:
            self.listbox.insert(tk.END, f"  {cmd}")
        if self.filtered_commands:
            self.listbox.select_set(0)
            
    def move_select_down(self, event):
        idx = self.listbox.curselection()
        if idx:
            next_idx = (idx[0] + 1) % self.listbox.size()
            self.listbox.selection_clear(0, tk.END)
            self.listbox.selection_set(next_idx)
            self.listbox.see(next_idx)
        return "break"
        
    def move_select_up(self, event):
        idx = self.listbox.curselection()
        if idx:
            prev_idx = (idx[0] - 1) % self.listbox.size()
            self.listbox.selection_clear(0, tk.END)
            self.listbox.selection_set(prev_idx)
            self.listbox.see(prev_idx)
        return "break"
        
    def execute_command(self, event=None):
        idx = self.listbox.curselection()
        if idx:
            cmd_name = self.filtered_commands[idx[0]]
            func = self.commands[cmd_name]
            self.destroy()
            func()
