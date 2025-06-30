// ===== SMART TO-DO LIST APPLICATION =====
// Modern, feature-rich task management application

class SmartTodoApp {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.currentSort = 'dateCreated';
        this.searchQuery = '';
        this.editingTaskId = null;
        this.undoTimeout = null;
        this.lastDeletedTask = null;
        this.draggedTask = null;
        
        this.init();
    }

    // ===== INITIALIZATION =====
    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.updateUI();
        this.initSpeechRecognition();
        this.checkDueDateReminders();
        
        // Set up periodic reminder checks
        setInterval(() => this.checkDueDateReminders(), 60000); // Check every minute
    }

    bindEvents() {
        // Form submission
        document.getElementById('addTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.updateUI();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Sort dropdown
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.updateUI();
        });

        // Theme toggle
        document.querySelector('.theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Menu toggle (mobile)
        document.querySelector('.menu-toggle').addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Action buttons
        document.getElementById('exportBtn').addEventListener('click', () => this.exportTasks());
        document.getElementById('importBtn').addEventListener('click', () => this.importTasks());
        document.getElementById('printBtn').addEventListener('click', () => this.printTasks());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllTasks());
        document.getElementById('speechBtn').addEventListener('click', () => this.startSpeechRecognition());

        // Import file handler
        document.getElementById('importFile').addEventListener('change', (e) => this.handleFileImport(e));

        // Modal events
        this.bindModalEvents();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Auto-focus on task title when page loads
        document.getElementById('taskTitle').focus();
    }

    bindModalEvents() {
        // Edit modal
        document.querySelector('#editModal .modal-close').addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeEditModal());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEditedTask());

        // Confirm modal
        document.querySelector('#confirmModal .modal-close').addEventListener('click', () => this.closeConfirmModal());
        document.getElementById('confirmCancel').addEventListener('click', () => this.closeConfirmModal());

        // Close modals on overlay click
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeEditModal();
        });
        document.getElementById('confirmModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeConfirmModal();
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
                this.closeConfirmModal();
            }
        });
    }

    // ===== TASK MANAGEMENT =====
    addTask() {
        const form = document.getElementById('addTaskForm');
        const formData = new FormData(form);
        
        const task = {
            id: this.generateId(),
            title: formData.get('title').trim(),
            description: formData.get('description').trim(),
            dueDate: formData.get('dueDate'),
            priority: formData.get('priority'),
            completed: false,
            dateCreated: new Date().toISOString(),
            dateCompleted: null
        };

        if (!task.title) {
            this.showToast('Please enter a task title', 'error');
            return;
        }

        this.tasks.unshift(task);
        this.saveToStorage();
        this.updateUI();
        this.showToast('Task added successfully!', 'success');
        
        form.reset();
        document.getElementById('taskTitle').focus();
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.editingTaskId = taskId;
        
        // Populate edit form
        document.getElementById('editTaskTitle').value = task.title;
        document.getElementById('editTaskDescription').value = task.description || '';
        document.getElementById('editTaskDueDate').value = task.dueDate || '';
        document.getElementById('editTaskPriority').value = task.priority;

        // Show modal
        this.showEditModal();
    }

    saveEditedTask() {
        const task = this.tasks.find(t => t.id === this.editingTaskId);
        if (!task) return;

        const title = document.getElementById('editTaskTitle').value.trim();
        if (!title) {
            this.showToast('Please enter a task title', 'error');
            return;
        }

        task.title = title;
        task.description = document.getElementById('editTaskDescription').value.trim();
        task.dueDate = document.getElementById('editTaskDueDate').value;
        task.priority = document.getElementById('editTaskPriority').value;

        this.saveToStorage();
        this.updateUI();
        this.closeEditModal();
        this.showToast('Task updated successfully!', 'success');
    }

    toggleTaskComplete(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.completed = !task.completed;
        task.dateCompleted = task.completed ? new Date().toISOString() : null;

        this.saveToStorage();
        this.updateUI();
        this.updateStreak();
        
        const message = task.completed ? 'Task completed! 🎉' : 'Task marked as pending';
        this.showToast(message, 'success');
    }

    deleteTask(taskId) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const task = this.tasks[taskIndex];
        this.lastDeletedTask = { task, index: taskIndex };

        this.tasks.splice(taskIndex, 1);
        this.saveToStorage();
        this.updateUI();

        // Show undo option
        this.showUndoToast();
    }

    undoDelete() {
        if (!this.lastDeletedTask) return;

        const { task, index } = this.lastDeletedTask;
        this.tasks.splice(index, 0, task);
        this.saveToStorage();
        this.updateUI();
        this.showToast('Task restored!', 'success');
        
        this.lastDeletedTask = null;
        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
        }
    }

    // ===== SEARCH, FILTER & SORT =====
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.updateUI();
        this.savePreferences();
    }

    getFilteredTasks() {
        let filtered = this.tasks;

        // Apply search
        if (this.searchQuery) {
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(this.searchQuery) ||
                (task.description && task.description.toLowerCase().includes(this.searchQuery))
            );
        }

        // Apply filter
        switch (this.currentFilter) {
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
            case 'pending':
                filtered = filtered.filter(task => !task.completed);
                break;
            default:
                // 'all' - no additional filtering
                break;
        }

        // Apply sort
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                
                case 'title':
                    return a.title.localeCompare(b.title);
                
                case 'titleDesc':
                    return b.title.localeCompare(a.title);
                
                case 'dateCreated':
                default:
                    return new Date(b.dateCreated) - new Date(a.dateCreated);
            }
        });

        return filtered;
    }

    // ===== UI UPDATES =====
    updateUI() {
        this.renderTasks();
        this.updateProgress();
        this.updateTaskCount();
        this.updateTasksTitle();
        this.checkForEmptyState();
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        const filteredTasks = this.getFilteredTasks();

        // Clear existing tasks (keep empty state)
        const existingTasks = container.querySelectorAll('.task-card');
        existingTasks.forEach(task => task.remove());

        filteredTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }

    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-card ${this.getTaskClasses(task)}`;
        taskDiv.dataset.taskId = task.id;
        taskDiv.draggable = true;
        
        // Add drag event listeners
        taskDiv.addEventListener('dragstart', (e) => this.handleDragStart(e, task));
        taskDiv.addEventListener('dragover', (e) => this.handleDragOver(e));
        taskDiv.addEventListener('drop', (e) => this.handleDrop(e, task));
        taskDiv.addEventListener('dragend', () => this.handleDragEnd());

        const dueDateText = task.dueDate ? this.formatDueDate(task.dueDate) : '';
        const dueDateClass = this.getDueDateClass(task.dueDate);

        taskDiv.innerHTML = `
            <div class="task-header">
                <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
                <div class="task-actions">
                    <button class="task-action-btn complete" onclick="app.toggleTaskComplete('${task.id}')" 
                            title="${task.completed ? 'Mark as pending' : 'Mark as complete'}"
                            aria-label="${task.completed ? 'Mark task as pending' : 'Mark task as complete'}">
                        ${task.completed ? '↶' : '✓'}
                    </button>
                    <button class="task-action-btn edit" onclick="app.editTask('${task.id}')" 
                            title="Edit task" aria-label="Edit task">
                        ✏️
                    </button>
                    <button class="task-action-btn delete" onclick="app.confirmDeleteTask('${task.id}')" 
                            title="Delete task" aria-label="Delete task">
                        🗑️
                    </button>
                </div>
            </div>
            
            ${task.description ? `<p class="task-description">${this.escapeHtml(task.description)}</p>` : ''}
            
            <div class="task-meta">
                <div class="task-due-date ${dueDateClass}">
                    ${dueDateText ? `📅 ${dueDateText}` : ''}
                </div>
                <span class="task-priority ${task.priority}">${task.priority}</span>
            </div>
        `;

        // Add animation for new tasks
        setTimeout(() => taskDiv.classList.add('new'), 10);

        return taskDiv;
    }

    getTaskClasses(task) {
        const classes = [];
        
        if (task.completed) {
            classes.push('completed');
        }
        
        if (task.dueDate && !task.completed) {
            const now = new Date();
            const dueDate = new Date(task.dueDate);
            
            if (dueDate < now) {
                classes.push('overdue');
            } else if (this.isToday(dueDate)) {
                classes.push('due-today');
            }
        }
        
        classes.push(`${task.priority}-priority`);
        
        return classes.join(' ');
    }

    getDueDateClass(dueDate) {
        if (!dueDate) return '';
        
        const now = new Date();
        const due = new Date(dueDate);
        
        if (due < now) return 'overdue';
        if (this.isToday(due)) return 'due-today';
        return '';
    }

    formatDueDate(dueDate) {
        const date = new Date(dueDate);
        const now = new Date();
        
        if (this.isToday(date)) {
            return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        }
        
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            return `Tomorrow ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays === -1) {
            return `Yesterday ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diffDays < 0) {
            return `${Math.abs(diffDays)} days ago`;
        } else if (diffDays <= 7) {
            return `In ${diffDays} days`;
        }
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
        });
    }

    updateProgress() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.completed).length;
        const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
        
        document.getElementById('progressPercent').textContent = `${percentage}%`;
        document.getElementById('progressFill').style.width = `${percentage}%`;
    }

    updateTaskCount() {
        const filteredTasks = this.getFilteredTasks();
        const count = filteredTasks.length;
        document.getElementById('taskCount').textContent = `${count} task${count !== 1 ? 's' : ''}`;
    }

    updateTasksTitle() {
        const titleElement = document.getElementById('tasksTitle');
        const filterTitles = {
            all: 'All Tasks',
            completed: 'Completed Tasks',
            pending: 'Pending Tasks'
        };
        
        let title = filterTitles[this.currentFilter] || 'All Tasks';
        
        if (this.searchQuery) {
            title += ` - Search: "${this.searchQuery}"`;
        }
        
        titleElement.textContent = title;
    }

    checkForEmptyState() {
        const container = document.getElementById('tasksContainer');
        const emptyState = document.getElementById('emptyState');
        const filteredTasks = this.getFilteredTasks();
        
        if (filteredTasks.length === 0) {
            emptyState.style.display = 'block';
            
            // Update empty state message based on context
            const title = emptyState.querySelector('h3');
            const message = emptyState.querySelector('p');
            
            if (this.tasks.length === 0) {
                title.textContent = 'No tasks yet';
                message.textContent = 'Add your first task to get started!';
            } else if (this.searchQuery) {
                title.textContent = 'No matching tasks';
                message.textContent = `No tasks found matching "${this.searchQuery}"`;
            } else if (this.currentFilter === 'completed') {
                title.textContent = 'No completed tasks';
                message.textContent = 'Complete some tasks to see them here!';
            } else if (this.currentFilter === 'pending') {
                title.textContent = 'No pending tasks';
                message.textContent = 'Great! All tasks are completed! 🎉';
            }
        } else {
            emptyState.style.display = 'none';
        }
    }

    // ===== DRAG AND DROP =====
    handleDragStart(e, task) {
        this.draggedTask = task;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e, targetTask) {
        e.preventDefault();
        
        if (!this.draggedTask || this.draggedTask.id === targetTask.id) return;
        
        const draggedIndex = this.tasks.findIndex(t => t.id === this.draggedTask.id);
        const targetIndex = this.tasks.findIndex(t => t.id === targetTask.id);
        
        // Remove dragged task and insert at target position
        const [draggedTaskObj] = this.tasks.splice(draggedIndex, 1);
        this.tasks.splice(targetIndex, 0, draggedTaskObj);
        
        this.saveToStorage();
        this.updateUI();
        this.showToast('Tasks reordered!', 'success');
    }

    handleDragEnd() {
        document.querySelectorAll('.task-card').forEach(card => {
            card.classList.remove('dragging');
        });
        this.draggedTask = null;
    }

    // ===== STREAK TRACKING =====
    updateStreak() {
        const today = new Date().toDateString();
        const completedToday = this.tasks.filter(task => 
            task.completed && 
            task.dateCompleted && 
            new Date(task.dateCompleted).toDateString() === today
        ).length;
        
        let streak = parseInt(localStorage.getItem('taskStreak') || '0');
        const lastStreakDate = localStorage.getItem('lastStreakDate');
        
        if (completedToday > 0) {
            if (lastStreakDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                if (lastStreakDate === yesterday.toDateString()) {
                    streak++;
                } else if (lastStreakDate !== today) {
                    streak = 1;
                }
                
                localStorage.setItem('taskStreak', streak.toString());
                localStorage.setItem('lastStreakDate', today);
            }
        }
        
        document.getElementById('streakCount').textContent = streak;
        
        // Show motivational message for milestones
        if (completedToday > 0 && [7, 30, 100].includes(streak)) {
            this.showToast(`Amazing! ${streak} day streak! 🔥`, 'success');
        }
    }

    // ===== THEME MANAGEMENT =====
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update theme toggle icon
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        
        this.showToast(`Switched to ${newTheme} theme`, 'success');
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }

    // ===== MOBILE MENU =====
    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('mobile-hidden');
    }

    // ===== DUE DATE REMINDERS =====
    checkDueDateReminders() {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        
        this.tasks.forEach(task => {
            if (!task.completed && task.dueDate) {
                const dueDate = new Date(task.dueDate);
                
                if (dueDate <= oneHourFromNow && dueDate > now) {
                    const reminderKey = `reminder_${task.id}_${dueDate.getTime()}`;
                    
                    if (!localStorage.getItem(reminderKey)) {
                        this.showReminder(task);
                        localStorage.setItem(reminderKey, 'shown');
                    }
                }
            }
        });
    }

    showReminder(task) {
        const timeLeft = new Date(task.dueDate) - new Date();
        const minutesLeft = Math.round(timeLeft / (1000 * 60));
        
        this.showToast(
            `⏰ "${task.title}" is due in ${minutesLeft} minutes!`,
            'warning',
            10000
        );
    }

    // ===== SPEECH RECOGNITION =====
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('taskTitle').value = transcript;
                this.showToast('Voice input captured!', 'success');
            };
            
            this.recognition.onerror = (event) => {
                this.showToast('Speech recognition error. Please try again.', 'error');
            };
        } else {
            // Hide speech button if not supported
            document.getElementById('speechBtn').style.display = 'none';
        }
    }

    startSpeechRecognition() {
        if (this.recognition) {
            this.recognition.start();
            this.showToast('Listening... Speak now!', 'success');
        }
    }

    // ===== EXPORT/IMPORT =====
    exportTasks() {
        const data = {
            tasks: this.tasks,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `smart-todo-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('Tasks exported successfully!', 'success');
    }

    importTasks() {
        document.getElementById('importFile').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.tasks && Array.isArray(data.tasks)) {
                    this.showConfirmModal(
                        'Import Tasks',
                        `This will replace your current ${this.tasks.length} tasks with ${data.tasks.length} imported tasks. Continue?`,
                        () => {
                            this.tasks = data.tasks;
                            this.saveToStorage();
                            this.updateUI();
                            this.showToast(`Successfully imported ${data.tasks.length} tasks!`, 'success');
                        }
                    );
                } else {
                    this.showToast('Invalid file format. Please select a valid backup file.', 'error');
                }
            } catch (error) {
                this.showToast('Error reading file. Please try again.', 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }

    // ===== PRINT =====
    printTasks() {
        window.print();
    }

    // ===== CLEAR ALL =====
    clearAllTasks() {
        if (this.tasks.length === 0) {
            this.showToast('No tasks to clear!', 'warning');
            return;
        }
        
        this.showConfirmModal(
            'Clear All Tasks',
            `Are you sure you want to delete all ${this.tasks.length} tasks? This action cannot be undone.`,
            () => {
                this.tasks = [];
                this.saveToStorage();
                this.updateUI();
                this.showToast('All tasks cleared!', 'success');
            }
        );
    }

    // ===== MODALS =====
    showEditModal() {
        const modal = document.getElementById('editModal');
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('editTaskTitle').focus();
    }

    closeEditModal() {
        const modal = document.getElementById('editModal');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        this.editingTaskId = null;
    }

    showConfirmModal(title, message, onConfirm) {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        
        const modal = document.getElementById('confirmModal');
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        
        // Set up confirm handler
        const confirmBtn = document.getElementById('confirmOk');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            this.closeConfirmModal();
        });
        
        newConfirmBtn.focus();
    }

    closeConfirmModal() {
        const modal = document.getElementById('confirmModal');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }

    confirmDeleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        this.showConfirmModal(
            'Delete Task',
            `Are you sure you want to delete "${task.title}"?`,
            () => this.deleteTask(taskId)
        );
    }

    // ===== TOAST NOTIFICATIONS =====
    showToast(message, type = 'success', duration = 5000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const toastId = this.generateId();
        toast.innerHTML = `
            <div class="toast-header">
                <h5 class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</h5>
                <button class="toast-close" onclick="app.removeToast('${toastId}')">&times;</button>
            </div>
            <p class="toast-message">${message}</p>
        `;
        
        toast.id = toastId;
        container.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto remove
        setTimeout(() => this.removeToast(toastId), duration);
    }

    showUndoToast() {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast warning';
        
        const toastId = this.generateId();
        toast.innerHTML = `
            <div class="toast-header">
                <h5 class="toast-title">Task Deleted</h5>
                <button class="toast-close" onclick="app.removeToast('${toastId}')">&times;</button>
            </div>
            <p class="toast-message">Task deleted successfully</p>
            <div class="toast-actions">
                <button class="btn btn-primary btn-sm" onclick="app.undoDelete(); app.removeToast('${toastId}')">
                    Undo
                </button>
            </div>
        `;
        
        toast.id = toastId;
        container.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto remove after 5 seconds
        this.undoTimeout = setTimeout(() => {
            this.removeToast(toastId);
            this.lastDeletedTask = null;
        }, 5000);
    }

    removeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }

    // ===== KEYBOARD SHORTCUTS =====
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    document.getElementById('taskTitle').focus();
                    break;
                case 'f':
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                    break;
                case 'e':
                    e.preventDefault();
                    this.exportTasks();
                    break;
                case 'p':
                    e.preventDefault();
                    this.printTasks();
                    break;
            }
        }
        
        // Other shortcuts
        switch (e.key) {
            case 'F1':
                e.preventDefault();
                this.showKeyboardShortcuts();
                break;
        }
    }

    showKeyboardShortcuts() {
        const shortcuts = `
Keyboard Shortcuts:
• Ctrl/Cmd + N: New task
• Ctrl/Cmd + F: Search tasks
• Ctrl/Cmd + E: Export tasks
• Ctrl/Cmd + P: Print tasks
• F1: Show this help
• ESC: Close modals
        `.trim();
        
        this.showToast(shortcuts, 'success', 10000);
    }

    // ===== STORAGE =====
    saveToStorage() {
        localStorage.setItem('smartTodoTasks', JSON.stringify(this.tasks));
        this.savePreferences();
    }

    loadFromStorage() {
        const saved = localStorage.getItem('smartTodoTasks');
        if (saved) {
            this.tasks = JSON.parse(saved);
        }
        
        this.loadPreferences();
        this.loadTheme();
    }

    savePreferences() {
        const preferences = {
            currentFilter: this.currentFilter,
            currentSort: this.currentSort,
            searchQuery: this.searchQuery
        };
        localStorage.setItem('smartTodoPreferences', JSON.stringify(preferences));
    }

    loadPreferences() {
        const saved = localStorage.getItem('smartTodoPreferences');
        if (saved) {
            const preferences = JSON.parse(saved);
            this.currentFilter = preferences.currentFilter || 'all';
            this.currentSort = preferences.currentSort || 'dateCreated';
            this.searchQuery = preferences.searchQuery || '';
            
            // Update UI elements
            document.getElementById('searchInput').value = this.searchQuery;
            document.getElementById('sortSelect').value = this.currentSort;
            
            // Update filter button
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === this.currentFilter);
            });
        }
    }

    // ===== UTILITY FUNCTIONS =====
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ===== INITIALIZE APPLICATION =====
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new SmartTodoApp();
});

// ===== SERVICE WORKER REGISTRATION (PWA) =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
