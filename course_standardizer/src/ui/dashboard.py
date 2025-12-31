import tkinter as tk
from tkinter import ttk
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.patches import Circle
from .modern_components.widgets import KPICard

class Dashboard(ttk.Frame):
    def __init__(self, parent, database):
        super().__init__(parent)
        self.db = database
        self.setup_ui()

    def setup_ui(self):
        # Title
        ttk.Label(self, text="Analytics Dashboard", font=("Segoe UI", 24, "bold")).pack(anchor="w", padx=20, pady=(20, 10))
        
        # KPI Cards Container
        kpi_frame = ttk.Frame(self)
        kpi_frame.pack(fill=tk.X, padx=20, pady=10)
        
        # Initialize Cards (will update values later)
        self.card_total = KPICard(kpi_frame, "Total Records", "0", "Files Processed", "📚", "#2196F3")
        self.card_total.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        self.card_auto = KPICard(kpi_frame, "Auto-Matched", "0%", "High Confidence", "✅", "#4CAF50")
        self.card_auto.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        self.card_review = KPICard(kpi_frame, "Needs Review", "0", "Possible Matches", "⚠️", "#FFC107")
        self.card_review.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        self.card_accuracy = KPICard(kpi_frame, "Accuracy", "0%", "Estimated", "🎯", "#9C27B0")
        self.card_accuracy.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        # Charts Container
        charts_frame = ttk.Frame(self)
        charts_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Create matplotlib figure
        self.fig = Figure(figsize=(10, 6), dpi=100, facecolor='#fafafa')
        self.ax1 = self.fig.add_subplot(121) # Pie
        self.ax2 = self.fig.add_subplot(122) # Bar
        
        canvas = FigureCanvasTkAgg(self.fig, master=charts_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # Refresh Button
        ttk.Button(self, text="Refresh Data", command=self.update_dashboard).pack(anchor="e", padx=20, pady=10)

    def update_dashboard(self):
        stats = self.db.get_stats()
        total = stats["total"]
        auto = stats["auto"]
        possible = stats["possible"]
        dnm = stats["dnm"]
        
        # Update Cards
        self.card_total.children['!label2'].configure(text=str(total))
        
        auto_pct = (auto / total * 100) if total > 0 else 0
        self.card_auto.children['!label2'].configure(text=f"{auto_pct:.1f}%")
        
        self.card_review.children['!label2'].configure(text=str(possible))
        
        # Estimated accuracy (auto + manual corrections / total)
        # For now just using auto match rate as proxy
        self.card_accuracy.children['!label2'].configure(text=f"{auto_pct:.1f}%")
        
        # Clear axes
        self.ax1.clear()
        self.ax2.clear()
        
        if total == 0:
            self.ax1.text(0.5, 0.5, "No Data", ha='center')
            self.fig.canvas.draw()
            return

        # Modern Pie Chart
        labels = ['Auto', 'Possible', 'No Match']
        sizes = [auto, possible, dnm]
        colors = ['#4CAF50', '#FFC107', '#F44336']
        explode = (0.05, 0, 0)
        
        self.ax1.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', 
                    startangle=90, pctdistance=0.85, explode=explode)
        
        # Donut hole
        centre_circle = Circle((0,0), 0.70, fc='#fafafa')
        self.ax1.add_artist(centre_circle)
        self.ax1.set_title('Match Distribution', pad=20, fontdict={'fontsize': 12, 'fontweight': 'bold'})
        
        # Bar Chart
        x = ['Auto', 'Possible', 'No Match']
        y = [auto, possible, dnm]
        bars = self.ax2.bar(x, y, color=colors)
        self.ax2.set_title('Record Counts', pad=20, fontdict={'fontsize': 12, 'fontweight': 'bold'})
        self.ax2.spines['top'].set_visible(False)
        self.ax2.spines['right'].set_visible(False)
        self.ax2.grid(axis='y', linestyle='--', alpha=0.3)
        
        # Redraw
        self.fig.canvas.draw()
