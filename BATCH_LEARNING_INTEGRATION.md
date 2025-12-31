# Integration Guide for Batch Processing & Auto-Learning

## Files Created:

1. src/core/learning.py - LearningManager class
2. src/ui/batch_dialog.py - BatchProcessDialog
3. src/ui/dialogs.py - Added LearningSuggestionDialog

## Files Modified:

1. src/core/processor.py - Added load_and_process_file() method

## Remaining Integration Steps:

### 1. Update config.json

Add these keys:

```json
{
  "learning_enabled": true,
  "learning_threshold": 3,
  "batch_max_workers": 4,
  "auto_apply_learned": false
}
```

### 2. Update main_window.py

#### A. Add imports (top of file):

```python
from .batch_dialog import BatchProcessDialog
from .dialogs import LearningSuggestionDialog
from ..core.learning import LearningManager
```

#### B. Initialize LearningManager in **init**:

```python
# After initializing processor
self.learning_manager = LearningManager(self.config, self.db, self.logger)
self.edit_count = 0  # Track edits for periodic learning checks
```

#### C. Add Batch Process menu item (in create_menu):

```python
# In File menu, after Load Files
file_menu.add_command(label="Batch Process Files...", command=self.batch_process_files)
```

#### D. Add batch_process_files method:

```python
def batch_process_files(self):
    \"\"\"Batch process multiple files\"\"\"
    files = filedialog.askopenfilenames(
        filetypes=[('Data files', '*.xlsx *.xls *.csv')]
    )
    if files:
        BatchProcessDialog(self.root, self.processor, list(files))
        # Refresh after processing
        self.refresh_ui()
```

#### E. Track corrections in on_tree_double_click (add after database update):

```python
# Track correction for learning
if self.learning_manager.enabled:
    self.learning_manager.track_correction(current_value, new_value)
    self.edit_count += 1
    if self.edit_count % 10 == 0:
        self.check_learning_suggestions()
```

#### F. Track corrections in context menu actions (in apply_suggestion_to_final, etc.):

```python
# Track for learning
if self.learning_manager.enabled:
    original = values[1]  # Original column
    suggested = values[2]  # Suggested column
    self.learning_manager.track_correction(original, suggested)
    self.edit_count += 1
```

#### G. Add check_learning_suggestions method:

```python
def check_learning_suggestions(self):
    \"\"\"Check for and display learning suggestions\"\"\"
    suggestions = self.learning_manager.get_suggestions()
    if suggestions:
        def handle_suggestion(original, correction, action):
            result = self.learning_manager.apply_suggestion(original, correction, action)
            if result and action == 'learn':
                # Add to error map
                self.processor.error_map[original] = correction
                self.processor.save_error_map(self.processor.error_map)
                messagebox.showinfo("Learned", f"Pattern added to error map!\\n{original} → {correction}")

        LearningSuggestionDialog(self.root, suggestions, handle_suggestion)
```

#### H. Update dashboard to show learning stats (in update_dashboard or stats display):

```python
learning_stats = self.learning_manager.get_stats()
# Display: Patterns Learned, Total Corrections, etc.
```

### 3. Test the features:

#### Batch Processing:

```
1. File → Batch Process Files...
2. Select 3-5 files
3. Watch progress dialog
4. Verify all files loaded and processed
```

#### Auto-Learning:

```
1. Edit a row: "DNB ORTHO" → "DNB IN ORTHOPAEDICS"
2. Repeat 2 more times with same pattern
3. After 10th total edit, dialog appears
4. Click "Add to Error Map"
5. Verify pattern added
6. Load new file with "DNB ORTHO" → auto-corrected
```

### 4. Update config:

```json
{
  "auto_threshold": 85,
  "possible_threshold": 70,
  "ignore_list": [],
  "ignore_brackets": false,
  "panel_positions": {},
  "theme": "dark",
  "use_lemmatization": true,
  "learning_enabled": true,
  "learning_threshold": 3,
  "batch_max_workers": 4
}
```

## Quick Integration (Copy-Paste)

Due to complexity, here's the full integration code ready to copy-paste into main_window.py:

See INTEGRATION_CODE.py for complete snippets.
