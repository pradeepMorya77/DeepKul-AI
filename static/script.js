// ========================================
// SynapseAI - Premium ChatBot JavaScript
// ========================================

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');
const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const suggestionCards = document.querySelectorAll('.suggestion-card');
const renameModal = document.getElementById('renameModal');
const renameInput = document.getElementById('renameInput');
const renameConfirm = document.getElementById('renameConfirm');
const renameCancel = document.getElementById('renameCancel');
const renameCancelBtn = document.getElementById('renameCancelBtn');

// Upload Elements
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const uploadedFilesBar = document.getElementById('uploadedFilesBar');
const filesList = document.getElementById('filesList');

// State
let currentChatId = null;
let chats = {};
let isStreaming = false;
let abortController = null;
let renamingChatId = null;
let uploadedFilesList = [];

// SynapseAI Icon SVG
const synapseIcon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
    </svg>
`;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadChatsFromStorage();
    renderChatHistory();
    setupEventListeners();
    setupFileUpload();
    autoResizeTextarea();
});

// Event Listeners
function setupEventListeners() {
    // Sidebar toggle
    sidebarToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // New chat
    newChatBtn.addEventListener('click', startNewChat);

    // Send message
    sendBtn.addEventListener('click', sendMessage);
    stopBtn.addEventListener('click', stopStreaming);

    // Input handling
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleKeyDown);

    // Suggestion cards
    suggestionCards.forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.dataset.prompt;
            messageInput.value = prompt;
            handleInputChange();
            sendMessage();
        });
    });

    // Rename modal
    renameConfirm.addEventListener('click', confirmRename);
    renameCancel.addEventListener('click', closeRenameModal);
    renameCancelBtn.addEventListener('click', closeRenameModal);
    renameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmRename();
        if (e.key === 'Escape') closeRenameModal();
    });
    
    // Close modal when clicking backdrop
    renameModal.querySelector('.modal-backdrop').addEventListener('click', closeRenameModal);
}

// File Upload Setup
function setupFileUpload() {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop on the entire input wrapper
    const inputWrapper = document.querySelector('.input-wrapper');
    
    inputWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBtn.classList.add('uploading');
    });
    
    inputWrapper.addEventListener('dragleave', () => {
        uploadBtn.classList.remove('uploading');
    });
    
    inputWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBtn.classList.remove('uploading');
        fileInput.files = e.dataTransfer.files;
        handleFileSelect();
    });
}

async function handleFileSelect() {
    const files = fileInput.files;
    if (!files.length) return;
    
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    
    // Show uploading state
    uploadBtn.classList.add('uploading');
    const originalIcon = uploadBtn.innerHTML;
    uploadBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"></path>
        </svg>
    `;
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Add successfully uploaded files to list
        if (data.files) {
            data.files.forEach(file => {
                if (file.status === 'ok' && !uploadedFilesList.includes(file.filename)) {
                    uploadedFilesList.push(file.filename);
                }
            });
        }
        
        // Show success feedback
        if (data.files && data.files.length > 0) {
            console.log(`✅ Uploaded ${data.files.length} file(s)`);
        }
        
        // Show any errors
        if (data.errors && data.errors.length > 0) {
            console.error('Upload errors:', data.errors);
        }
        
        renderUploadedFiles();
        
    } catch (e) {
        console.error('Upload failed:', e);
        // Optional: show error to user
    } finally {
        uploadBtn.classList.remove('uploading');
        uploadBtn.innerHTML = originalIcon;
        fileInput.value = '';
    }
}

function renderUploadedFiles() {
    if (uploadedFilesList.length === 0) {
        uploadedFilesBar.classList.remove('visible');
        return;
    }
    
    uploadedFilesBar.classList.add('visible');
    filesList.innerHTML = uploadedFilesList
        .map((f, i) => `
            <div class="file-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>${escapeHtml(f)}</span>
                <button class="remove-file" data-index="${i}" title="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `)
        .join('');
    
    // Add remove handlers
    filesList.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            uploadedFilesList.splice(index, 1);
            renderUploadedFiles();
        });
    });
}

// Sidebar functions
function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('visible');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
}

// Chat management
function startNewChat() {
    currentChatId = null;
    chatMessages.innerHTML = '';
    chatMessages.classList.remove('active');
    welcomeScreen.style.display = 'flex';
    messageInput.value = '';
    handleInputChange();
    updateActiveChatInHistory();
    closeSidebar();
}

function createNewChat(firstMessage) {
    const chatId = 'chat_' + Date.now();
    const title = firstMessage.slice(0, 35) + (firstMessage.length > 35 ? '...' : '');
    
    chats[chatId] = {
        id: chatId,
        title: title,
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    currentChatId = chatId;
    saveChatsToStorage();
    renderChatHistory();
    return chatId;
}

function loadChat(chatId) {
    if (!chats[chatId]) return;
    
    currentChatId = chatId;
    welcomeScreen.style.display = 'none';
    chatMessages.classList.add('active');
    chatMessages.innerHTML = '';
    
    chats[chatId].messages.forEach(msg => {
        appendMessage(msg.role, msg.content, false);
    });
    
    updateActiveChatInHistory();
    scrollToBottom();
    closeSidebar();
}

function deleteChat(chatId) {
    if (!confirm('Delete this chat?')) return;
    
    delete chats[chatId];
    saveChatsToStorage();
    renderChatHistory();
    
    if (currentChatId === chatId) {
        startNewChat();
    }
}

function startRenameChat(chatId, event) {
    event.stopPropagation();
    renamingChatId = chatId;
    renameInput.value = chats[chatId].title;
    renameModal.classList.add('visible');
    renameInput.focus();
    renameInput.select();
}

function confirmRename() {
    const newTitle = renameInput.value.trim();
    
    if (!renamingChatId || !newTitle) {
        closeRenameModal();
        return;
    }
    
    chats[renamingChatId].title = newTitle;
    saveChatsToStorage();
    renderChatHistory();
    closeRenameModal();
}

function closeRenameModal() {
    renameModal.classList.remove('visible');
    renamingChatId = null;
    renameInput.value = '';
}

// Storage functions
function saveChatsToStorage() {
    try {
        localStorage.setItem('synapseai_chats', JSON.stringify(chats));
    } catch (e) {
        console.error('Failed to save chats:', e);
    }
}

function loadChatsFromStorage() {
    try {
        const saved = localStorage.getItem('synapseai_chats');
        if (saved) {
            chats = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load chats:', e);
        chats = {};
    }
}

// Render chat history
function renderChatHistory() {
    chatHistory.innerHTML = '';
    
    const sortedChats = Object.values(chats).sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    sortedChats.forEach(chat => {
        const item = document.createElement('button');
        item.className = 'chat-history-item' + (chat.id === currentChatId ? ' active' : '');
        item.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chat-history-item-text">${escapeHtml(chat.title)}</span>
            <div class="chat-history-item-actions">
                <button class="chat-action-btn rename-btn" title="Rename">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                </button>
                <button class="chat-action-btn delete-btn" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        item.addEventListener('click', () => loadChat(chat.id));
        
        const renameBtn = item.querySelector('.rename-btn');
        const deleteBtn = item.querySelector('.delete-btn');
        
        renameBtn.addEventListener('click', (e) => startRenameChat(chat.id, e));
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });
        
        chatHistory.appendChild(item);
    });
}

function updateActiveChatInHistory() {
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Message handling
function handleInputChange() {
    const hasText = messageInput.value.trim().length > 0;
    sendBtn.disabled = !hasText || isStreaming;
    autoResizeTextarea();
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
            sendMessage();
        }
    }
}

function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isStreaming) return;

    if (!currentChatId) {
        createNewChat(message);
        welcomeScreen.style.display = 'none';
        chatMessages.classList.add('active');
    }

    appendMessage('user', message);
    chats[currentChatId].messages.push({ role: 'user', content: message });
    saveChatsToStorage();

    messageInput.value = '';
    handleInputChange();

    const typingIndicator = showTypingIndicator();

    isStreaming = true;
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');

    abortController = new AbortController();

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: chats[currentChatId].messages.slice(0, -1)
            }),
            signal: abortController.signal
        });

        if (!response.ok) throw new Error('Request failed');

        typingIndicator.remove();

        const botMessageEl = appendMessage('bot', '', false);
        const bubbleEl = botMessageEl.querySelector('.message-bubble');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let botResponse = '';
        let buffer = '';
        let updateScheduled = false;

        const scheduleUpdate = () => {
            if (updateScheduled) return;
            updateScheduled = true;
            
            requestAnimationFrame(() => {
                if (buffer.length > 0) {
                    botResponse += buffer;
                    bubbleEl.innerHTML = formatMessage(botResponse);
                    buffer = '';
                    scrollToBottom();
                }
                updateScheduled = false;
            });
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                try {
                    const data = JSON.parse(line.slice(6));

                    if (data.error) {
                        bubbleEl.innerHTML = `<div class="error-message">${escapeHtml(data.error)}</div>`;
                        break;
                    }

                    if (data.token) {
                        buffer += data.token;
                        scheduleUpdate();
                    }

                    if (data.done) {
                        botResponse += buffer;
                        bubbleEl.innerHTML = formatMessage(botResponse);
                        buffer = '';
                        updateScheduled = false;
                        break;
                    }

                } catch {}
            }
        }

        if (botResponse) {
            chats[currentChatId].messages.push({ role: 'bot', content: botResponse });
            saveChatsToStorage();
        }

    } catch (error) {
        typingIndicator.remove();

        if (error.name !== 'AbortError') {
            appendMessage('bot', 'Unable to connect. Please ensure Backend  is running.', true);
        }
    } finally {
        isStreaming = false;
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        abortController = null;
        handleInputChange();
    }
}

function stopStreaming() {
    if (abortController) {
        abortController.abort();
    }
}

function appendMessage(role, content, animate = true) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    
    // Use SynapseAI icon for bot, "U" for user
    const avatarContent = role === 'user' ? 'U' : synapseIcon;
    
    messageEl.innerHTML = `
        <div class="message-avatar">${avatarContent}</div>
        <div class="message-content">
            <div class="message-bubble">${formatMessage(content)}</div>
            ${role === 'bot' ? `
                <div class="message-actions">
                    <button class="message-action-btn copy-btn" title="Copy">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    // Add copy functionality
    const copyBtn = messageEl.querySelector('.copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                const textToCopy = messageEl.querySelector('.message-bubble').innerText;
                await navigator.clipboard.writeText(textToCopy);
                
                const originalHTML = copyBtn.innerHTML;
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = originalHTML;
                }, 2000);
                
            } catch (err) {
                console.error('Copy failed:', err);
            }
        });
    }
    
    chatMessages.appendChild(messageEl);
    
    if (animate) {
        scrollToBottom();
    }
    
    return messageEl;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <div class="message-avatar">${synapseIcon}</div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(indicator);
    scrollToBottom();
    return indicator;
}

// Utility functions
function formatMessage(text) {
    if (!text) return '';
    
    let formatted = escapeHtml(text);
    
    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });
    
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // Lists
    formatted = formatted.replace(/^[\s]*[-*]\s+(.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Numbered lists
    formatted = formatted.replace(/^[\s]*(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Clean up multiple breaks
    formatted = formatted.replace(/(<br>){3,}/g, '<br><br>');
    
    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}
