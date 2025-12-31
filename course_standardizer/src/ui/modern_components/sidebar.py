import tkinter as tk
from tkinter import ttk

class Sidebar(ttk.Frame):
    """Modern sidebar navigation"""
    
    def __init__(self, parent, callback):
        super().__init__(parent, style="Sidebar.TFrame")
        self.callback = callback
        self.buttons = {}
        self.active_btn = None
        
        self.setup_ui()
        
    def setup_ui(self):
        # Logo / Title area
        title_frame = ttk.Frame(self, padding=(10, 20))
        title_frame.pack(fill=tk.X)
        ttk.Label(title_frame, text="CS", font=("Segoe UI", 20, "bold"), foreground="#2196F3").pack()
        
        # Navigation Items
        self.nav_frame = ttk.Frame(self, padding=(5, 20))
        self.nav_frame.pack(fill=tk.BOTH, expand=True)
        
        self.add_nav_item("dashboard", "📊", "Dashboard")
        self.add_nav_item("data", "💾", "Data")
        self.add_nav_item("tools", "🛠", "Tools")
        
        # Bottom Items
        bottom_frame = ttk.Frame(self, padding=(5, 20))
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.add_nav_item("settings", "⚙", "Settings", parent=bottom_frame)
        
    def add_nav_item(self, key, icon, text, parent=None):
        if parent is None:
            parent = self.nav_frame
            
        btn_frame = ttk.Frame(parent, cursor="hand2")
        btn_frame.pack(fill=tk.X, pady=2)
        
        # Style will be handled by changing background
        btn = ttk.Label(btn_frame, text=f" {icon}  {text}", 
                       font=("Segoe UI", 11), padding=(15, 10))
        btn.pack(fill=tk.X)
        
        # Bind events
        btn.bind("<Button-1>", lambda e, k=key: self.on_click(k))
        btn.bind("<Enter>", lambda e: self.on_hover(btn_frame, True))
        btn.bind("<Leave>", lambda e: self.on_hover(btn_frame, False))
        
        self.buttons[key] = {"frame": btn_frame, "label": btn}
        
    def on_click(self, key):
        if self.active_btn:
            # Reset previous active
            self.buttons[self.active_btn]["frame"].configure(style="TFrame")
            self.buttons[self.active_btn]["label"].configure(foreground="")
            
        self.active_btn = key
        # Set new active
        # Note: Actual styling depends on theme, using simple color change for now
        self.buttons[key]["label"].configure(foreground="#2196F3")
        
        self.callback(key)
        
    def on_hover(self, frame, enter):
        if frame == self.buttons.get(self.active_btn, {}).get("frame"):
            return
        # Hover effect
        # frame.configure(style="Hover.TFrame" if enter else "TFrame")
        pass
