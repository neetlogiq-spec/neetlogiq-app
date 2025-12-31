import tkinter as tk
from tkinter import ttk

class KPICard(ttk.Frame):
    """Key Performance Indicator Card"""
    
    def __init__(self, parent, title, value, subtext="", icon="📊", color="#2196F3"):
        super().__init__(parent, style="Card.TFrame", padding=15)
        
        # Header
        header = ttk.Frame(self)
        header.pack(fill=tk.X)
        
        ttk.Label(header, text=title, font=("Segoe UI", 10), foreground="#888").pack(side=tk.LEFT)
        ttk.Label(header, text=icon, font=("Segoe UI", 12), foreground=color).pack(side=tk.RIGHT)
        
        # Value
        ttk.Label(self, text=value, font=("Segoe UI", 24, "bold")).pack(anchor="w", pady=(5, 0))
        
        # Subtext
        if subtext:
            ttk.Label(self, text=subtext, font=("Segoe UI", 9), foreground="#666").pack(anchor="w")

class ContextActionBar(tk.Toplevel):
    """Floating action bar for context-sensitive actions"""
    
    def __init__(self, parent, actions):
        super().__init__(parent)
        self.overrideredirect(True)
        self.configure(bg="#333")
        
        # Rounded corners simulation (padding)
        container = tk.Frame(self, bg="#333", padx=2, pady=2)
        container.pack(fill=tk.BOTH, expand=True)
        
        inner = tk.Frame(container, bg="#444")
        inner.pack(fill=tk.BOTH, expand=True)
        
        for text, command, icon in actions:
            btn = tk.Button(inner, text=f"{icon} {text}", command=command,
                           bg="#444", fg="white", activebackground="#555", activeforeground="white",
                           relief="flat", font=("Segoe UI", 10), padx=10, pady=5)
            btn.pack(side=tk.LEFT, padx=1)
            
        # Position at bottom center
        self.update_idletasks()
        w = self.winfo_width()
        h = self.winfo_height()
        
        root_x = parent.winfo_rootx()
        root_w = parent.winfo_width()
        root_y = parent.winfo_rooty()
        root_h = parent.winfo_height()
        
        x = root_x + (root_w // 2) - (w // 2)
        y = root_y + root_h - h - 50
        
        self.geometry(f"{w}x{h}+{x}+{y}")
