"""
Batch Processing Dialog with Progress Tracking
"""

import tkinter as tk
from tkinter import ttk
import threading
import time

class BatchProcessDialog(tk.Toplevel):
    """Dialog for batch processing with progress tracking"""
    
    def __init__(self, parent, processor, file_paths):
        super().__init__(parent)
        self.processor = processor
        self.file_paths = file_paths
        self.paused = False
        self.cancelled = False
        self.start_time = time.time()
        
        self.title("Batch Processing")
        self.geometry("600x400")
        self.transient(parent)
        self.grab_set()
        
        self.setup_ui()
        
        # Start processing in background thread
        self.processing_thread = threading.Thread(target=self.process_files)
        self.processing_thread.daemon = True
        self.processing_thread.start()
        
        # Update UI periodically
        self.update_ui()
    
    def setup_ui(self):
        """Setup the UI components"""
        main_frame = ttk.Frame(self, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        ttk.Label(main_frame, text="Processing Files", font=("Segoe UI", 14, "bold")).pack(pady=(0, 20))
        
        # Overall progress
        ttk.Label(main_frame, text="Overall Progress:").pack(anchor="w")
        self.overall_progress = ttk.Progressbar(main_frame, mode="determinate", length=540)
        self.overall_progress.pack(fill=tk.X, pady=5)
        self.overall_label = ttk.Label(main_frame, text="0 / 0 files (0%)")
        self.overall_label.pack(anchor="w", pady=(0, 15))
        
        # Current file
        ttk.Label(main_frame, text="Current File:").pack(anchor="w")
        self.current_file_label = ttk.Label(main_frame, text="Initializing...", foreground="#666")
        self.current_file_label.pack(anchor="w", pady=(0, 5))
        
        # Current file progress
        self.file_progress = ttk.Progressbar(main_frame, mode="indeterminate", length=540)
        self.file_progress.pack(fill=tk.X, pady=5)
        self.file_progress.start(10)
        
        # Statistics
        stats_frame = ttk.LabelFrame(main_frame, text="Statistics", padding="10")
        stats_frame.pack(fill=tk.BOTH, expand=True, pady=15)
        
        self.stats_text = tk.Text(stats_frame, height=6, wrap=tk.WORD, state="disabled", bg="#f5f5f5")
        self.stats_text.pack(fill=tk.BOTH, expand=True)
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(15, 0))
        
        self.pause_button = ttk.Button(button_frame, text="Pause", command=self.toggle_pause)
        self.pause_button.pack(side=tk.LEFT, padx=(0, 10))
        
        self.cancel_button = ttk.Button(button_frame, text="Cancel", command=self.cancel)
        self.cancel_button.pack(side=tk.LEFT)
        
        self.close_button = ttk.Button(button_frame, text="Close", command=self.destroy, state="disabled")
        self.close_button.pack(side=tk.RIGHT)
    
    def process_files(self):
        """Process files in background thread"""
        total_files = len(self.file_paths)
        processed_files = 0
        total_records = 0
        total_errors = 0
        
        for i, file_path in enumerate(self.file_paths):
            # Check for pause
            while self.paused and not self.cancelled:
                time.sleep(0.1)
            
            # Check for cancellation
            if self.cancelled:
                break
            
            # Update current file
            self.current_file = file_path
            self.current_file_index = i
            
            # Process file
            try:
                # Load and process file
                result = self.processor.load_and_process_file(file_path)
                total_records += result.get('records', 0)
                processed_files += 1
            except Exception as e:
                total_errors += 1
                self.logger.error(f"Failed to process {file_path}: {e}")
        
        # Mark as complete
        self.processing_complete = True
        self.total_files_processed = processed_files
        self.total_records_processed = total_records
        self.total_errors = total_errors
    
    def update_ui(self):
        """Update UI with current progress"""
        if not hasattr(self, 'processing_complete'):
            self.processing_complete = False
        
        if not self.processing_complete:
            # Update progress
            if hasattr(self, 'current_file_index'):
                progress = (self.current_file_index / len(self.file_paths)) * 100
                self.overall_progress['value'] = progress
                self.overall_label.config(text=f"{self.current_file_index} / {len(self.file_paths)} files ({progress:.1f}%)")
                
                if hasattr(self, 'current_file'):
                    import os
                    filename = os.path.basename(self.current_file)
                    self.current_file_label.config(text=filename)
            
            # Update stats
            elapsed = time.time() - self.start_time
            eta = 0
            if hasattr(self, 'current_file_index') and self.current_file_index > 0:
                rate = self.current_file_index / elapsed
                remaining = len(self.file_paths) - self.current_file_index
                eta = remaining / rate if rate > 0 else 0
            
            stats = f"""Time Elapsed: {elapsed:.1f}s
ETA: {eta:.1f}s
Files Processed: {getattr(self, 'current_file_index', 0)}
Total Files: {len(self.file_paths)}
Status: {"Paused" if self.paused else "Processing..."}"""
            
            self.stats_text.config(state="normal")
            self.stats_text.delete("1.0", tk.END)
            self.stats_text.insert("1.0", stats)
            self.stats_text.config(state="disabled")
            
            # Schedule next update
            self.after(100, self.update_ui)
        else:
            # Processing complete
            self.overall_progress['value'] = 100
            self.overall_label.config(text=f"{len(self.file_paths)} / {len(self.file_paths)} files (100%)")
            self.current_file_label.config(text="Complete!")
            self.file_progress.stop()
            
            elapsed = time.time() - self.start_time
            stats = f"""Processing Complete!

Time Elapsed: {elapsed:.1f}s
Files Processed: {getattr(self, 'total_files_processed', 0)}
Records Processed: {getattr(self, 'total_records_processed', 0)}
Errors: {getattr(self, 'total_errors', 0)}"""
            
            self.stats_text.config(state="normal")
            self.stats_text.delete("1.0", tk.END)
            self.stats_text.insert("1.0", stats)
            self.stats_text.config(state="disabled")
            
            self.pause_button.config(state="disabled")
            self.cancel_button.config(state="disabled")
            self.close_button.config(state="normal")
    
    def toggle_pause(self):
        """Toggle pause state"""
        self.paused = not self.paused
        if self.paused:
            self.pause_button.config(text="Resume")
        else:
            self.pause_button.config(text="Pause")
    
    def cancel(self):
        """Cancel processing"""
        self.cancelled = True
        self.destroy()
