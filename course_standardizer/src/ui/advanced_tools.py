import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, simpledialog
from rapidfuzz import process, fuzz

class ValidationWindow(tk.Toplevel):
    """Window for displaying validation results"""
    def __init__(self, parent, results):
        super().__init__(parent)
        self.title("Validation Results")
        self.geometry("700x500")
        self.transient(parent)
        
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

class AIAssistWindow(tk.Toplevel):
    """Window for AI-powered analysis"""
    def __init__(self, parent, original, nlp, standard_terms):
        super().__init__(parent)
        self.title("AI Assist")
        self.geometry("500x400")
        self.transient(parent)
        
        ttk.Label(self, text=f"Analyzing: {original}", font=("Segoe UI", 10, "bold")).pack(pady=10)
        
        if nlp:
            doc = nlp(original)
            entities = [(ent.text, ent.label_) for ent in doc.ents]
            
            if entities:
                ttk.Label(self, text="Detected Entities:", font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=10)
                for ent, label in entities:
                    ttk.Label(self, text=f"  • {ent} ({label})").pack(anchor="w", padx=20)
        
        # Find similar courses
        similar = []
        for std in standard_terms:
            score = fuzz.ratio(original.upper(), std.upper())
            if score > 60:
                similar.append((std, score))
        similar.sort(key=lambda x: x[1], reverse=True)
        
        if similar:
            ttk.Label(self, text="Similar Standard Terms:", font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=10, pady=(10, 0))
            for term, score in similar[:5]:
                ttk.Label(self, text=f"  • {term} ({score}%)").pack(anchor="w", padx=20)
        
        ttk.Button(self, text="Close", command=self.destroy).pack(pady=20)

class FeedbackWindow(tk.Toplevel):
    """Window for collecting user feedback on uncertain matches"""
    def __init__(self, parent, uncertain_matches, processor, db):
        super().__init__(parent)
        self.processor = processor
        self.db = db
        self.title("Provide Feedback")
        self.geometry("700x600")
        self.transient(parent)
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
            self.feedback_data.append((record_id, var, original))
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        button_frame = ttk.Frame(frame)
        button_frame.pack(fill="x", pady=10)
        ttk.Button(button_frame, text="Submit Feedback", command=self.submit_feedback).pack(side="right")
        ttk.Button(button_frame, text="Cancel", command=self.destroy).pack(side="right", padx=10)
    
    def submit_feedback(self):
        """Process collected feedback"""
        for record_id, var, original in self.feedback_data:
            feedback = var.get()
            if feedback == "accept":
                self.db.cursor.execute("UPDATE processed_courses SET final = suggested WHERE id = ?", (record_id,))
            elif feedback == "reject":
                # Could add to ignore list
                pass
            elif feedback == "modify":
                correct = simpledialog.askstring("Modify Match", f"Enter correct value for:\\n{original}")
                if correct:
                    correct_upper = correct.strip().upper()
                    self.processor.error_map[original] = correct_upper
                    self.processor.save_error_map(self.processor.error_map)
        
        self.db.conn.commit()
        messagebox.showinfo("Feedback Processed", "Thank you for your feedback!")
        self.destroy()

class DiffViewWidget(ttk.Frame):
    """Widget for showing text differences"""
    def __init__(self, parent):
        super().__init__(parent)
        
        self.diff_text = scrolledtext.ScrolledText(self, wrap=tk.WORD, state="disabled", height=5)
        self.diff_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.diff_text.tag_config('added', foreground='#4CAF50', font=("Courier New", 10, "bold"))
        self.diff_text.tag_config('removed', foreground='#F44336', overstrike=True)
    
    def show_diff(self, original, final):
        """Update diff display"""
        import difflib
        
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
    
    def clear(self):
        """Clear diff display"""
        self.diff_text.config(state='normal')
        self.diff_text.delete('1.0', 'end')
        self.diff_text.config(state='disabled')

class QualityReportWindow(tk.Toplevel):
    """Window for displaying data quality report"""
    def __init__(self, parent, quality_data):
        super().__init__(parent)
        self.title("Quality Report")
        self.geometry("600x500")
        self.transient(parent)
        
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        # Quality Score
        score = quality_data['score']
        score_color = "#4CAF50" if score >= 80 else "#FFC107" if score >= 60 else "#F44336"
        
        score_frame = ttk.Frame(frame)
        score_frame.pack(fill=tk.X, pady=10)
        ttk.Label(score_frame, text="Overall Quality Score:", font=("Segoe UI", 12)).pack(side=tk.LEFT)
        score_label = ttk.Label(score_frame, text=f"{score}/100", font=("Segoe UI", 16, "bold"))
        score_label.pack(side=tk.LEFT, padx=10)
        
        # Metrics
        metrics_frame = ttk.LabelFrame(frame, text="Metrics")
        metrics_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        tree = ttk.Treeview(metrics_frame, columns=("Metric", "Value", "Status"), show="headings", height=8)
        tree.heading("Metric", text="Metric")
        tree.heading("Value", text="Value")
        tree.heading("Status", text="Status")
        tree.column("Metric", width=200)
        tree.column("Value", width=150)
        tree.column("Status", width=100)
        
        for metric, value, status in quality_data['metrics']:
            tree.insert("", "end", values=(metric, value, status))
        
        tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Recommendations
        if quality_data.get('recommendations'):
            rec_frame = ttk.LabelFrame(frame, text="Recommendations")
            rec_frame.pack(fill=tk.BOTH, expand=True, pady=10)
            
            rec_text = scrolledtext.ScrolledText(rec_frame, wrap=tk.WORD, height=6)
            rec_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
            for rec in quality_data['recommendations']:
                rec_text.insert(tk.END, f"• {rec}\n")
            rec_text.config(state='disabled')
        
        ttk.Button(frame, text="Close", command=self.destroy).pack(pady=10)

class ConflictReportWindow(tk.Toplevel):
    """Window for displaying error map conflicts"""
    def __init__(self, parent, conflicts):
        super().__init__(parent)
        self.title("Error Map Conflicts")
        self.geometry("700x400")
        self.transient(parent)
        
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        if not conflicts:
            ttk.Label(frame, text="No conflicts found! ✓", font=("Segoe UI", 12)).pack(pady=20)
        else:
            ttk.Label(frame, text=f"Found {len(conflicts)} conflict(s):", font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=5)
            
            tree = ttk.Treeview(frame, columns=("Correction", "Errors"), show="headings")
            tree.heading("Correction", text="Correction")
            tree.heading("Errors", text="Conflicting Errors")
            tree.column("Correction", width=200)
            tree.column("Errors", width=450)
            
            for correction, errors in conflicts.items():
                tree.insert("", "end", values=(correction, ", ".join(errors)))
            
            tree.pack(fill=tk.BOTH, expand=True, pady=10)
            
            ttk.Label(frame, text="⚠️ Multiple errors map to the same correction. Review and consolidate.", 
                     foreground="#F44336").pack(anchor="w", pady=5)
        
        ttk.Button(frame, text="Close", command=self.destroy).pack(pady=10)
# Additional classes to append to advanced_tools.py

class AuditLogViewerWindow(tk.Toplevel):
    """Window for viewing audit log"""
    def __init__(self, parent, database):
        super().__init__(parent)
        self.db = database
        self.title("Audit Log")
        self.geometry("900x500")
        self.transient(parent)
        
        frame = ttk.Frame(self, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        # Filter frame
        filter_frame = ttk.Frame(frame)
        filter_frame.pack(fill=tk.X, pady=5)
        ttk.Label(filter_frame, text="Filter by Action:").pack(side=tk.LEFT, padx=5)
        self.filter_var = tk.StringVar(value="All")
        filter_combo = ttk.Combobox(filter_frame, textvariable=self.filter_var, 
                                    values=["All", "edit", "bulk_apply", "import", "export"], state="readonly")
        filter_combo.pack(side=tk.LEFT, padx=5)
        filter_combo.bind("<<ComboboxSelected>>", lambda e: self.load_logs())
        ttk.Button(filter_frame, text="Refresh", command=self.load_logs).pack(side=tk.LEFT, padx=5)
        
        # Tree
        tree_frame = ttk.Frame(frame)
        tree_frame.pack(fill=tk.BOTH, expand=True)
        
        tree = ttk.Treeview(tree_frame, columns=("Timestamp", "User", "Action", "Details"), show="headings")
        tree.heading("Timestamp", text="Timestamp")
        tree.heading("User", text="User")
        tree.heading("Action", text="Action")
        tree.heading("Details", text="Details")
        tree.column("Timestamp", width=150)
        tree.column("User", width=100)
        tree.column("Action", width=120)
        tree.column("Details", width=400)
        
        scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.tree = tree
        self.load_logs()
        
        ttk.Button(frame, text="Close", command=self.destroy).pack(pady=10)
    
    def load_logs(self):
        """Load audit logs from database"""
        self.tree.delete(*self.tree.get_children())
        
        filter_action = self.filter_var.get()
        query = "SELECT timestamp, user, action, details FROM audit_log"
        if filter_action != "All":
            query += f" WHERE action = '{filter_action}'"
        query += " ORDER BY timestamp DESC LIMIT 500"
        
        try:
            self.db.cursor.execute(query)
            for row in self.db.cursor.fetchall():
                self.tree.insert("", "end", values=row)
        except:
            pass  # Table might not exist yet
