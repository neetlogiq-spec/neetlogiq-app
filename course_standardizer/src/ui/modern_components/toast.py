import tkinter as tk
from tkinter import ttk
import time

class ToastNotification(tk.Toplevel):
    """Floating toast notification"""
    
    def __init__(self, parent, message, kind="info", duration=3000):
        super().__init__(parent)
        self.overrideredirect(True)
        
        # Colors
        colors = {
            "info": "#2196F3",
            "success": "#4CAF50",
            "error": "#F44336",
            "warning": "#FFC107"
        }
        accent = colors.get(kind, "#2196F3")
        
        # UI
        self.configure(bg="#333333")
        
        # Border/Accent strip
        strip = tk.Frame(self, bg=accent, width=5)
        strip.pack(side=tk.LEFT, fill=tk.Y)
        
        # Content
        content = tk.Frame(self, bg="#333333", padx=15, pady=10)
        content.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        icon = {"info": "ℹ", "success": "✓", "error": "✕", "warning": "⚠"}.get(kind, "ℹ")
        tk.Label(content, text=icon, fg=accent, bg="#333333", font=("Arial", 14, "bold")).pack(side=tk.LEFT, padx=(0, 10))
        
        tk.Label(content, text=message, fg="white", bg="#333333", font=("Segoe UI", 10)).pack(side=tk.LEFT)
        
        # Position (Bottom Right)
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        
        x = screen_width - width - 20
        y = screen_height - height - 60
        
        self.geometry(f"{width}x{height}+{x}+{y}")
        
        # Animation (Fade out)
        self.after(duration, self.fade_out)
        
        # Click to dismiss
        self.bind("<Button-1>", lambda e: self.destroy())
        
    def fade_out(self):
        alpha = self.attributes("-alpha")
        if alpha > 0:
            alpha -= 0.1
            self.attributes("-alpha", alpha)
            self.after(50, self.fade_out)
        else:
            self.destroy()

class ToastManager:
    """Manages toast notifications"""
    def __init__(self, root):
        self.root = root
        
    def show(self, message, kind="info", duration=3000):
        ToastNotification(self.root, message, kind, duration)
