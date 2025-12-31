class CommandHistory:
    """Manages the undo/redo stacks"""
    
    def __init__(self, max_size=50):
        self.undo_stack = []
        self.redo_stack = []
        self.max_size = max_size
        
    def push(self, command):
        """Execute a new command and add to history"""
        command.execute()
        self.undo_stack.append(command)
        self.redo_stack.clear() # Clear redo stack on new action
        
        # Limit stack size
        if len(self.undo_stack) > self.max_size:
            self.undo_stack.pop(0)
            
    def undo(self):
        """Undo the last command"""
        if not self.undo_stack:
            return None
            
        command = self.undo_stack.pop()
        command.undo()
        self.redo_stack.append(command)
        return command
        
    def redo(self):
        """Redo the last undone command"""
        if not self.redo_stack:
            return None
            
        command = self.redo_stack.pop()
        command.execute()
        self.undo_stack.append(command)
        return command
        
    def can_undo(self):
        return len(self.undo_stack) > 0
        
    def can_redo(self):
        return len(self.redo_stack) > 0
