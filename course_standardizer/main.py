import tkinter as tk
import sv_ttk
from src.ui.main_window import MainWindow

def main():
    root = tk.Tk()
    
    # Set theme
    sv_ttk.set_theme("light")
    
    app = MainWindow(root)
    root.mainloop()

if __name__ == "__main__":
    main()
