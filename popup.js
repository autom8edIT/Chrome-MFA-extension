// Load and display saved MFA codes
function loadSavedCodes() {
  chrome.storage.sync.get(['mfaCodes'], function(result) {
    const codes = result.mfaCodes || [];
    displayCodes(codes);
  });
}

// Display codes in the UI
function displayCodes(codes) {
  const container = document.getElementById('savedCodes');
  
  if (codes.length === 0) {
    container.innerHTML = '<p class="empty-message">No saved codes yet.</p>';
    return;
  }
  
  container.innerHTML = '';
  codes.forEach((code, index) => {
    const codeItem = document.createElement('div');
    codeItem.className = 'code-item';
    
    const codeInfo = document.createElement('div');
    codeInfo.className = 'code-info';
    
    const codeName = document.createElement('div');
    codeName.className = 'code-name';
    codeName.textContent = code.siteName;
    
    const codeUrl = document.createElement('div');
    codeUrl.className = 'code-url';
    codeUrl.textContent = code.siteUrl;
    
    const codeValue = document.createElement('div');
    codeValue.className = 'code-value';
    codeValue.textContent = '••••••'; // Hide the actual code for security
    
    codeInfo.appendChild(codeName);
    codeInfo.appendChild(codeUrl);
    codeInfo.appendChild(codeValue);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = function() {
      deleteCode(index);
    };
    
    codeItem.appendChild(codeInfo);
    codeItem.appendChild(deleteBtn);
    container.appendChild(codeItem);
  });
}

// Add new MFA code
document.getElementById('addCodeForm').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const siteName = document.getElementById('siteName').value.trim();
  const siteUrl = document.getElementById('siteUrl').value.trim();
  const mfaCode = document.getElementById('mfaCode').value.trim();
  const selector = document.getElementById('selector').value.trim();
  
  if (!siteName || !siteUrl || !mfaCode) {
    showErrorMessage('Please fill in all required fields');
    return;
  }
  
  const newCode = {
    siteName,
    siteUrl,
    mfaCode,
    selector: selector || null,
    createdAt: new Date().toISOString()
  };
  
  chrome.storage.sync.get(['mfaCodes'], function(result) {
    const codes = result.mfaCodes || [];
    codes.push(newCode);
    
    chrome.storage.sync.set({ mfaCodes: codes }, function() {
      // Show success message
      showSuccessMessage('MFA code added successfully!');
      
      // Clear form
      document.getElementById('addCodeForm').reset();
      
      // Reload displayed codes
      loadSavedCodes();
    });
  });
});

// Delete a code
function deleteCode(index) {
  if (!confirm('Are you sure you want to delete this MFA code?')) {
    return;
  }
  
  chrome.storage.sync.get(['mfaCodes'], function(result) {
    const codes = result.mfaCodes || [];
    codes.splice(index, 1);
    
    chrome.storage.sync.set({ mfaCodes: codes }, function() {
      showSuccessMessage('MFA code deleted successfully!');
      loadSavedCodes();
    });
  });
}

// Clear all codes
document.getElementById('clearAll').addEventListener('click', function() {
  if (!confirm('Are you sure you want to delete all saved MFA codes? This action cannot be undone.')) {
    return;
  }
  
  chrome.storage.sync.set({ mfaCodes: [] }, function() {
    showSuccessMessage('All MFA codes cleared!');
    loadSavedCodes();
  });
});

// Show success message
function showSuccessMessage(message) {
  const existingMessage = document.querySelector('.success-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'success-message';
  messageDiv.textContent = message;
  
  const firstSection = document.querySelector('.section');
  firstSection.insertBefore(messageDiv, firstSection.firstChild);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

// Show error message
function showErrorMessage(message) {
  const existingMessage = document.querySelector('.error-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'error-message';
  messageDiv.textContent = message;
  
  const firstSection = document.querySelector('.section');
  firstSection.insertBefore(messageDiv, firstSection.firstChild);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

// Load codes when popup opens
document.addEventListener('DOMContentLoaded', loadSavedCodes);
