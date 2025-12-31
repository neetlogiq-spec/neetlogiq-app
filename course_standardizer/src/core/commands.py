from abc import ABC, abstractmethod

class Command(ABC):
    """Abstract base class for all commands"""
    
    @abstractmethod
    def execute(self):
        """Execute the command"""
        pass
        
    @abstractmethod
    def undo(self):
        """Undo the command"""
        pass
        
    @abstractmethod
    def description(self):
        """Return a description of the command"""
        pass

class EditCommand(Command):
    """Command for editing a single cell"""
    
    def __init__(self, db, tree, row_id, column, old_value, new_value):
        self.db = db
        self.tree = tree
        self.row_id = row_id
        self.column = column
        self.old_value = old_value
        self.new_value = new_value
        
    def execute(self):
        # Update Database
        self.db.update_course(self.row_id, self.new_value)
        
        # Update UI
        self.tree.set(self.row_id, self.column, self.new_value)
        
    def undo(self):
        # Revert Database
        self.db.update_course(self.row_id, self.old_value)
        
        # Revert UI
        self.tree.set(self.row_id, self.column, self.old_value)
        
    def description(self):
        return f"Edit '{self.old_value}' -> '{self.new_value}'"

class BulkUpdateCommand(Command):
    """Command for bulk updates (Approve/Reject)"""
    
    def __init__(self, db, tree, updates, action_type):
        """
        updates: List of (row_id, old_value, new_value) tuples
        action_type: "Approve" or "Reject"
        """
        self.db = db
        self.tree = tree
        self.updates = updates
        self.action_type = action_type
        
    def execute(self):
        for row_id, _, new_value in self.updates:
            self.db.update_course(row_id, new_value)
            # Assuming column 5 is 'Final' - this might need to be dynamic
            self.tree.set(row_id, "Final", new_value)
            
    def undo(self):
        for row_id, old_value, _ in self.updates:
            self.db.update_course(row_id, old_value)
            self.tree.set(row_id, "Final", old_value)
            
    def description(self):
        return f"Bulk {self.action_type} ({len(self.updates)} items)"
