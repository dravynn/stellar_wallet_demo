import CryptoJS from 'crypto-js';

const STORAGE_KEY = 'stellar_seed_vault';
const ENCRYPTION_KEY = 'stellar_demo_vault_key'; // In production, use a user-provided password

/**
 * Seed Vault Service
 * Manages encrypted storage of Stellar account seeds
 */
class SeedVault {
  constructor() {
    this.accounts = this.loadAccounts();
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  /**
   * Load accounts from localStorage
   */
  loadAccounts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return this.decrypt(stored);
    } catch (error) {
      console.error('Error loading accounts:', error);
      return [];
    }
  }

  /**
   * Save accounts to localStorage
   */
  saveAccounts() {
    try {
      const encrypted = this.encrypt(this.accounts);
      localStorage.setItem(STORAGE_KEY, encrypted);
      return true;
    } catch (error) {
      console.error('Error saving accounts:', error);
      return false;
    }
  }

  /**
   * Add a new account to the vault
   */
  addAccount(accountName, secretKey) {
    if (!accountName || !secretKey) {
      throw new Error('Account name and secret key are required');
    }

    // Check if account name already exists
    if (this.accounts.some(acc => acc.name === accountName)) {
      throw new Error('Account name already exists');
    }

    const account = {
      id: Date.now().toString(),
      name: accountName,
      secretKey: secretKey, // Already encrypted in storage
      createdAt: new Date().toISOString()
    };

    this.accounts.push(account);
    this.saveAccounts();
    return account;
  }

  /**
   * Get all accounts
   */
  getAllAccounts() {
    return this.accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      createdAt: acc.createdAt,
      // Don't expose secret key in list
    }));
  }

  /**
   * Get account by ID
   */
  getAccount(id) {
    return this.accounts.find(acc => acc.id === id);
  }

  /**
   * Get secret key for an account
   */
  getSecretKey(id) {
    const account = this.getAccount(id);
    return account ? account.secretKey : null;
  }

  /**
   * Remove an account from the vault
   */
  removeAccount(id) {
    this.accounts = this.accounts.filter(acc => acc.id !== id);
    this.saveAccounts();
  }

  /**
   * Clear all accounts
   */
  clearVault() {
    this.accounts = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get vault statistics
   */
  getStats() {
    return {
      totalAccounts: this.accounts.length,
      isEmpty: this.accounts.length === 0
    };
  }
}

export default new SeedVault();
