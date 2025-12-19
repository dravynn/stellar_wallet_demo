import seedVault from './services/seedVault.js';
import stellarWallet from './services/stellarWallet.js';
import { showModal, closeModal, createInputModal, createConfirmModal } from './utils/modal.js';

// DOM Elements
const createAccountBtn = document.getElementById('createAccountBtn');
const importAccountBtn = document.getElementById('importAccountBtn');
const exportVaultBtn = document.getElementById('exportVaultBtn');
const clearVaultBtn = document.getElementById('clearVaultBtn');
const vaultStatus = document.getElementById('vaultStatus');
const accountsList = document.getElementById('accountsList');
const walletContent = document.getElementById('walletContent');

let selectedAccountId = null;

// Initialize
function init() {
  renderAccountsList();
  attachEventListeners();
}

// Event Listeners
function attachEventListeners() {
  createAccountBtn.addEventListener('click', handleCreateAccount);
  importAccountBtn.addEventListener('click', handleImportAccount);
  exportVaultBtn.addEventListener('click', handleExportVault);
  clearVaultBtn.addEventListener('click', handleClearVault);
}

// Create new account
async function handleCreateAccount() {
  createInputModal(
    'Create New Account',
    [
      {
        id: 'accountName',
        label: 'Account Name',
        type: 'text',
        placeholder: 'My Stellar Account',
        required: true
      }
    ],
    async (data) => {
      try {
        showStatus('Creating new Stellar account...', 'info');
        
        const newAccount = await stellarWallet.createAccount();
        const vaultAccount = seedVault.addAccount(data.accountName, newAccount.secretKey);
        
        showStatus(`Account "${data.accountName}" created successfully!`, 'success');
        renderAccountsList();
        
        // Auto-select the new account
        selectAccount(vaultAccount.id);
      } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
      }
    }
  );
}

// Import existing account
function handleImportAccount() {
  createInputModal(
    'Import Account',
    [
      {
        id: 'accountName',
        label: 'Account Name',
        type: 'text',
        placeholder: 'My Imported Account',
        required: true
      },
      {
        id: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        placeholder: 'S...',
        required: true,
        help: 'Enter your Stellar secret key (starts with S)'
      }
    ],
    (data) => {
      try {
        // Validate secret key format
        if (!data.secretKey.startsWith('S')) {
          throw new Error('Invalid secret key format');
        }

        // Test if keypair can be created
        stellarWallet.getKeypairFromSecret(data.secretKey);
        
        const vaultAccount = seedVault.addAccount(data.accountName, data.secretKey);
        showStatus(`Account "${data.accountName}" imported successfully!`, 'success');
        renderAccountsList();
        
        // Auto-select the imported account
        selectAccount(vaultAccount.id);
      } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
      }
    }
  );
}

// Export vault
function handleExportVault() {
  const accounts = seedVault.getAllAccounts();
  if (accounts.length === 0) {
    showStatus('No accounts to export', 'info');
    return;
  }

  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    accounts: accounts.map(acc => ({
      name: acc.name,
      createdAt: acc.createdAt
      // Note: Secret keys are not exported for security
    }))
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `stellar-vault-export-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showStatus('Vault exported successfully', 'success');
}

// Clear vault
function handleClearVault() {
  createConfirmModal(
    'Clear Vault',
    'Are you sure you want to clear the entire vault? This action cannot be undone and all accounts will be permanently removed.',
    () => {
      seedVault.clearVault();
      showStatus('Vault cleared successfully', 'info');
      renderAccountsList();
      walletContent.innerHTML = '<p class="info-message">Select an account from the vault to view wallet details</p>';
      selectedAccountId = null;
    }
  );
}

// Render accounts list
function renderAccountsList() {
  const accounts = seedVault.getAllAccounts();
  const stats = seedVault.getStats();

  if (stats.isEmpty) {
    accountsList.innerHTML = '<p class="empty-message">No accounts in vault. Create or import an account to get started.</p>';
    return;
  }

  accountsList.innerHTML = accounts.map(account => `
    <div class="account-item ${selectedAccountId === account.id ? 'selected' : ''}" 
         data-account-id="${account.id}">
      <div class="account-header">
        <h3>${escapeHtml(account.name)}</h3>
        <span class="account-date">${formatDate(account.createdAt)}</span>
      </div>
      <div class="account-actions">
        <button class="btn btn-small btn-primary" onclick="selectAccount('${account.id}')">View</button>
        <button class="btn btn-small btn-danger" onclick="removeAccount('${account.id}')">Remove</button>
      </div>
    </div>
  `).join('');

  // Attach click handlers
  accountsList.querySelectorAll('.account-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        const accountId = item.dataset.accountId;
        selectAccount(accountId);
      }
    });
  });
}

// Select account and load wallet details
async function selectAccount(accountId) {
  selectedAccountId = accountId;
  renderAccountsList();

  const account = seedVault.getAccount(accountId);
  if (!account) return;

  const secretKey = seedVault.getSecretKey(accountId);
  const keypair = stellarWallet.getKeypairFromSecret(secretKey);
  const publicKey = keypair.publicKey();

  walletContent.innerHTML = '<div class="loading">Loading account details...</div>';

  try {
    let accountDetails = await stellarWallet.loadAccount(publicKey);
    let transactions = [];
    
    if (!accountDetails.isNewAccount) {
      try {
        transactions = await stellarWallet.getTransactions(publicKey, 5);
      } catch (err) {
        console.error('Error loading transactions:', err);
      }
    }
    
    // If account is new, offer to fund it
    if (accountDetails.isNewAccount) {
      walletContent.innerHTML = `
        <div class="account-details">
          <h3>${escapeHtml(account.name)}</h3>
          <div class="account-info">
            <div class="info-row">
              <label>Public Key:</label>
              <code class="public-key">${publicKey}</code>
              <button class="btn btn-small" onclick="copyToClipboard('${publicKey}')">Copy</button>
            </div>
            <div class="info-row">
              <label>Status:</label>
              <span class="status-badge new">New Account</span>
            </div>
            <div class="info-row">
              <label>Secret Key:</label>
              <div style="display: flex; gap: 8px; flex: 1; align-items: center;">
                <code class="public-key" id="secretKeyDisplay-${accountId}" style="display: none;">${secretKey}</code>
                <span id="secretKeyHidden-${accountId}">••••••••••••••••</span>
                <button class="btn btn-small" onclick="toggleSecretKey('${accountId}')" id="toggleSecret-${accountId}">Show</button>
                <button class="btn btn-small" onclick="copyToClipboard('${secretKey}')">Copy</button>
              </div>
            </div>
            <p class="info-message">This account hasn't been funded yet. Click the button below to fund it on the testnet.</p>
            <button class="btn btn-primary" onclick="fundAccount('${accountId}')">Fund Testnet Account</button>
          </div>
        </div>
      `;
    } else {
      // Account exists, show full details
      const totalXLM = accountDetails.balances.find(b => b.asset === 'XLM');
      const xlmBalance = totalXLM ? parseFloat(totalXLM.balance) : 0;
      
      walletContent.innerHTML = `
        <div class="account-details">
          <h3>${escapeHtml(account.name)}</h3>
          <div class="account-info">
            <div class="info-row">
              <label>Public Key:</label>
              <code class="public-key">${publicKey}</code>
              <button class="btn btn-small" onclick="copyToClipboard('${publicKey}')">Copy</button>
            </div>
            <div class="info-row">
              <label>Status:</label>
              <span class="status-badge active">Active</span>
            </div>
            <div class="balances-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4>Balances</h4>
                ${xlmBalance > 0 ? `<button class="btn btn-small btn-primary" onclick="showSendPayment('${accountId}')">Send Payment</button>` : ''}
              </div>
              ${accountDetails.balances.length > 0 ? `
                <div class="balances-list">
                  ${accountDetails.balances.map(balance => `
                    <div class="balance-item">
                      <span class="balance-asset">${balance.asset}</span>
                      <span class="balance-amount">${parseFloat(balance.balance).toFixed(7)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="info-message">No balances found</p>'}
            </div>
            ${transactions.length > 0 ? `
              <div class="transactions-section">
                <h4>Recent Transactions</h4>
                <div class="transactions-list">
                  ${transactions.map(tx => `
                    <div class="transaction-item">
                      <div class="transaction-header">
                        <span class="transaction-id">${tx.hash.substring(0, 8)}...</span>
                        <span class="transaction-status ${tx.successful ? 'success' : 'failed'}">${tx.successful ? 'Success' : 'Failed'}</span>
                      </div>
                      <div class="transaction-meta">
                        <span>Ledger: ${tx.ledger}</span>
                        <span>${formatDate(tx.createdAt)}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <button class="btn btn-small btn-secondary" onclick="viewAllTransactions('${accountId}')" style="margin-top: 12px;">View All Transactions</button>
              </div>
            ` : ''}
            <div class="account-meta">
              <div class="meta-item">
                <label>Sequence Number:</label>
                <span>${accountDetails.sequenceNumber}</span>
              </div>
              <div class="meta-item">
                <label>Subentry Count:</label>
                <span>${accountDetails.subentryCount}</span>
              </div>
            </div>
            <div class="wallet-actions">
              <button class="btn btn-secondary" onclick="refreshAccount('${accountId}')">Refresh</button>
              <button class="btn btn-secondary" onclick="viewSecretKey('${accountId}')">View Secret Key</button>
            </div>
          </div>
        </div>
      `;
    }
  } catch (error) {
    walletContent.innerHTML = `
      <div class="error-message">
        <p>Error loading account: ${escapeHtml(error.message)}</p>
        <button class="btn btn-secondary" onclick="selectAccount('${accountId}')">Retry</button>
      </div>
    `;
  }
}

// Show send payment modal
function showSendPayment(accountId) {
  const account = seedVault.getAccount(accountId);
  if (!account) return;

  const secretKey = seedVault.getSecretKey(accountId);
  const keypair = stellarWallet.getKeypairFromSecret(secretKey);
  const publicKey = keypair.publicKey();

  createInputModal(
    'Send Payment',
    [
      {
        id: 'destination',
        label: 'Destination Public Key',
        type: 'text',
        placeholder: 'G...',
        required: true,
        help: 'Enter the recipient\'s Stellar public key'
      },
      {
        id: 'amount',
        label: 'Amount (XLM)',
        type: 'number',
        placeholder: '10.5',
        required: true,
        help: 'Enter the amount to send'
      }
    ],
    async (data) => {
      try {
        showStatus('Sending payment...', 'info');
        await stellarWallet.createPayment(keypair, data.destination, data.amount);
        showStatus('Payment sent successfully!', 'success');
        setTimeout(() => {
          selectAccount(accountId);
        }, 1500);
      } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
      }
    }
  );
}

// View secret key
function viewSecretKey(accountId) {
  const account = seedVault.getAccount(accountId);
  if (!account) return;

  const secretKey = seedVault.getSecretKey(accountId);
  
  showModal(
    'Secret Key',
    `
      <div style="margin-bottom: 20px;">
        <p style="margin-bottom: 12px; color: var(--gray-600); font-size: 13px;">⚠️ Keep this secret key secure. Anyone with access to it can control your account.</p>
        <code class="public-key" style="display: block; padding: 16px; margin-bottom: 16px; word-break: break-all;">${secretKey}</code>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="copyToClipboard('${secretKey}'); closeModal();">Copy Secret Key</button>
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
      </div>
    `
  );
}

// Toggle secret key visibility
function toggleSecretKey(accountId) {
  const display = document.getElementById(`secretKeyDisplay-${accountId}`);
  const hidden = document.getElementById(`secretKeyHidden-${accountId}`);
  const toggle = document.getElementById(`toggleSecret-${accountId}`);
  
  if (display.style.display === 'none') {
    display.style.display = 'block';
    hidden.style.display = 'none';
    toggle.textContent = 'Hide';
  } else {
    display.style.display = 'none';
    hidden.style.display = 'block';
    toggle.textContent = 'Show';
  }
}

// View all transactions
async function viewAllTransactions(accountId) {
  const account = seedVault.getAccount(accountId);
  if (!account) return;

  const secretKey = seedVault.getSecretKey(accountId);
  const keypair = stellarWallet.getKeypairFromSecret(secretKey);
  const publicKey = keypair.publicKey();

  try {
    showStatus('Loading transactions...', 'info');
    const transactions = await stellarWallet.getTransactions(publicKey, 20);
    
    const transactionsHTML = transactions.map(tx => `
      <div class="transaction-item" style="margin-bottom: 12px; padding: 12px; border: 1px solid var(--gray-200);">
        <div class="transaction-header" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <code style="font-size: 11px; color: var(--gray-600);">${tx.hash}</code>
          <span class="transaction-status ${tx.successful ? 'success' : 'failed'}">${tx.successful ? 'Success' : 'Failed'}</span>
        </div>
        <div class="transaction-meta" style="display: flex; gap: 16px; font-size: 12px; color: var(--gray-500);">
          <span>Ledger: ${tx.ledger}</span>
          <span>Operations: ${tx.operationCount}</span>
          <span>${formatDate(tx.createdAt)}</span>
        </div>
      </div>
    `).join('');

    showModal(
      'Transaction History',
      `
        <div style="max-height: 500px; overflow-y: auto;">
          ${transactions.length > 0 ? transactionsHTML : '<p class="info-message">No transactions found</p>'}
        </div>
        <div class="modal-actions" style="margin-top: 20px;">
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
      `
    );
  } catch (error) {
    showStatus(`Error loading transactions: ${error.message}`, 'error');
  }
}

// Fund testnet account
async function fundAccount(accountId) {
  const account = seedVault.getAccount(accountId);
  if (!account) return;

  const secretKey = seedVault.getSecretKey(accountId);
  const keypair = stellarWallet.getKeypairFromSecret(secretKey);
  const publicKey = keypair.publicKey();

  try {
    showStatus('Funding account on testnet...', 'info');
    await stellarWallet.fundTestnetAccount(publicKey);
    showStatus('Account funded successfully!', 'success');
    
    // Wait a bit for the account to be available
    setTimeout(() => {
      selectAccount(accountId);
    }, 2000);
  } catch (error) {
    showStatus(`Error funding account: ${error.message}`, 'error');
  }
}

// Refresh account
function refreshAccount(accountId) {
  selectAccount(accountId);
}

// Remove account
function removeAccount(accountId) {
  const account = seedVault.getAccount(accountId);
  createConfirmModal(
    'Remove Account',
    `Are you sure you want to remove "${account.name}" from the vault? This action cannot be undone.`,
    () => {
      seedVault.removeAccount(accountId);
      showStatus('Account removed from vault', 'info');
      renderAccountsList();
      
      if (selectedAccountId === accountId) {
        walletContent.innerHTML = '<p class="info-message">Select an account from the vault to view wallet details</p>';
        selectedAccountId = null;
      }
    }
  );
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showStatus('Copied to clipboard!', 'success');
  }).catch(() => {
    showStatus('Failed to copy', 'error');
  });
}

// Show status message
function showStatus(message, type = 'info') {
  vaultStatus.textContent = message;
  vaultStatus.className = `status-message ${type}`;
  vaultStatus.style.display = 'block';
  
  setTimeout(() => {
    vaultStatus.style.display = 'none';
  }, 3000);
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Make functions available globally for onclick handlers
window.selectAccount = selectAccount;
window.removeAccount = removeAccount;
window.fundAccount = fundAccount;
window.refreshAccount = refreshAccount;
window.copyToClipboard = copyToClipboard;
window.closeModal = closeModal;
window.showSendPayment = showSendPayment;
window.viewSecretKey = viewSecretKey;
window.toggleSecretKey = toggleSecretKey;
window.viewAllTransactions = viewAllTransactions;

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
