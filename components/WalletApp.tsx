'use client'

import { useState, useEffect } from 'react'
import seedVault from '@/lib/services/seedVault'
import stellarWallet from '@/lib/services/stellarWallet'
import Modal from './Modal'
import AccountList from './AccountList'
import WalletDetails from './WalletDetails'

export default function WalletApp() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const [modal, setModal] = useState<{ type: string; props?: any } | null>(null)

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = () => {
    setAccounts(seedVault.getAllAccounts())
  }

  const showStatus = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatus({ message, type })
    setTimeout(() => setStatus(null), 3000)
  }

  const handleCreateAccount = () => {
    setModal({
      type: 'create',
      props: {
        onSubmit: async (data: { accountName: string }) => {
          try {
            showStatus('Creating new Stellar account...', 'info')
            const newAccount = await stellarWallet.createAccount()
            const vaultAccount = seedVault.addAccount(data.accountName, newAccount.secretKey)
            showStatus(`Account "${data.accountName}" created successfully!`, 'success')
            loadAccounts()
            setSelectedAccountId(vaultAccount.id)
            setModal(null)
          } catch (error: any) {
            showStatus(`Error: ${error.message}`, 'error')
          }
        }
      }
    })
  }

  const handleImportAccount = () => {
    setModal({
      type: 'import',
      props: {
        onSubmit: (data: { accountName: string; secretKey: string }) => {
          try {
            if (!data.secretKey.startsWith('S')) {
              throw new Error('Invalid secret key format')
            }
            stellarWallet.getKeypairFromSecret(data.secretKey)
            const vaultAccount = seedVault.addAccount(data.accountName, data.secretKey)
            showStatus(`Account "${data.accountName}" imported successfully!`, 'success')
            loadAccounts()
            setSelectedAccountId(vaultAccount.id)
            setModal(null)
          } catch (error: any) {
            showStatus(`Error: ${error.message}`, 'error')
          }
        }
      }
    })
  }

  const handleExportVault = () => {
    if (accounts.length === 0) {
      showStatus('No accounts to export', 'info')
      return
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      accounts: accounts.map(acc => ({
        name: acc.name,
        createdAt: acc.createdAt
      }))
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `stellar-vault-export-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
    showStatus('Vault exported successfully', 'success')
  }

  const handleClearVault = () => {
    setModal({
      type: 'confirm',
      props: {
        message: 'Are you sure you want to clear the entire vault? This action cannot be undone and all accounts will be permanently removed.',
        onConfirm: () => {
          seedVault.clearVault()
          showStatus('Vault cleared successfully', 'info')
          loadAccounts()
          setSelectedAccountId(null)
          setModal(null)
        }
      }
    })
  }

  const handleRemoveAccount = (accountId: string) => {
    const account = seedVault.getAccount(accountId)
    setModal({
      type: 'confirm',
      props: {
        message: `Are you sure you want to remove "${account?.name}" from the vault? This action cannot be undone.`,
        onConfirm: () => {
          seedVault.removeAccount(accountId)
          showStatus('Account removed from vault', 'info')
          loadAccounts()
          if (selectedAccountId === accountId) {
            setSelectedAccountId(null)
          }
          setModal(null)
        }
      }
    })
  }

  return (
    <div id="app">
      <header>
        <h1>Stellar Wallet</h1>
        <p className="subtitle">Seed Vault</p>
      </header>

      <main>
        <div className="container">
          <section className="vault-section">
            <h2>Seed Vault</h2>
            <div className="vault-controls">
              <button className="btn btn-primary" onClick={handleCreateAccount}>Create New Account</button>
              <button className="btn btn-secondary" onClick={handleImportAccount}>Import Account</button>
              <button className="btn btn-secondary" onClick={handleExportVault}>Export Vault</button>
              <button className="btn btn-danger" onClick={handleClearVault}>Clear Vault</button>
            </div>

            {status && (
              <div className={`status-message ${status.type} show`}>
                {status.message}
              </div>
            )}

            <AccountList
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelect={setSelectedAccountId}
              onRemove={handleRemoveAccount}
            />
          </section>

          <section className="wallet-section">
            <h2>Wallet Operations</h2>
            <WalletDetails
              accountId={selectedAccountId}
              onStatus={showStatus}
              onRefresh={loadAccounts}
              onShowModal={(type, props) => setModal({ type, props })}
            />
          </section>
        </div>
      </main>

      {modal && (
        <Modal
          isOpen={true}
          onClose={() => setModal(null)}
          title={
            modal.type === 'create' ? 'Create New Account' :
            modal.type === 'import' ? 'Import Account' :
            modal.type === 'confirm' ? 'Confirm Action' :
            modal.type === 'send' ? 'Send Payment' :
            modal.type === 'secret' ? 'Secret Key' :
            modal.type === 'transactions' ? 'Transaction History' : 'Modal'
          }
        >
          {modal.type === 'create' && <CreateAccountForm onSubmit={modal.props.onSubmit} onCancel={() => setModal(null)} />}
          {modal.type === 'import' && <ImportAccountForm onSubmit={modal.props.onSubmit} onCancel={() => setModal(null)} />}
          {modal.type === 'confirm' && <ConfirmDialog message={modal.props.message} onConfirm={modal.props.onConfirm} onCancel={() => setModal(null)} />}
          {modal.type === 'send' && <SendPaymentForm accountId={modal.props.accountId} onSubmit={modal.props.onSubmit} onCancel={() => setModal(null)} />}
          {modal.type === 'secret' && <SecretKeyView secretKey={modal.props.secretKey} onClose={() => setModal(null)} />}
          {modal.type === 'transactions' && <TransactionsView transactions={modal.props.transactions} onClose={() => setModal(null)} />}
        </Modal>
      )}
    </div>
  )
}

function CreateAccountForm({ onSubmit, onCancel }: { onSubmit: (data: { accountName: string }) => void; onCancel: () => void }) {
  const [accountName, setAccountName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (accountName.trim()) {
      onSubmit({ accountName: accountName.trim() })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="accountName">Account Name</label>
        <input
          type="text"
          id="accountName"
          className="form-input"
          placeholder="My Stellar Account"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          required
        />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Create</button>
      </div>
    </form>
  )
}

function ImportAccountForm({ onSubmit, onCancel }: { onSubmit: (data: { accountName: string; secretKey: string }) => void; onCancel: () => void }) {
  const [accountName, setAccountName] = useState('')
  const [secretKey, setSecretKey] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (accountName.trim() && secretKey.trim()) {
      onSubmit({ accountName: accountName.trim(), secretKey: secretKey.trim() })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="accountName">Account Name</label>
        <input
          type="text"
          id="accountName"
          className="form-input"
          placeholder="My Imported Account"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="secretKey">Secret Key</label>
        <input
          type="password"
          id="secretKey"
          className="form-input"
          placeholder="S..."
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          required
        />
        <small className="form-help">Enter your Stellar secret key (starts with S)</small>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Import</button>
      </div>
    </form>
  )
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <p>{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>Confirm</button>
      </div>
    </>
  )
}

function SendPaymentForm({ accountId, onSubmit, onCancel }: { accountId: string; onSubmit: (data: { destination: string; amount: number }) => void; onCancel: () => void }) {
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(amount)
    if (destination.trim() && amountNum > 0) {
      onSubmit({ destination: destination.trim(), amount: amountNum })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="destination">Destination Public Key</label>
        <input
          type="text"
          id="destination"
          className="form-input"
          placeholder="G..."
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
        />
        <small className="form-help">Enter the recipient's Stellar public key</small>
      </div>
      <div className="form-group">
        <label htmlFor="amount">Amount (XLM)</label>
        <input
          type="number"
          id="amount"
          className="form-input"
          placeholder="10.5"
          step="0.0000001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <small className="form-help">Enter the amount to send</small>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Send</button>
      </div>
    </form>
  )
}

function SecretKeyView({ secretKey, onClose }: { secretKey: string; onClose: () => void }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(secretKey)
    onClose()
  }

  return (
    <>
      <div style={{ marginBottom: '20px' }}>
        <p style={{ marginBottom: '12px', color: 'var(--gray-600)', fontSize: '13px' }}>
          ⚠️ Keep this secret key secure. Anyone with access to it can control your account.
        </p>
        <code className="public-key" style={{ display: 'block', padding: '16px', marginBottom: '16px', wordBreak: 'break-all' }}>
          {secretKey}
        </code>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={copyToClipboard}>Copy Secret Key</button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  )
}

function TransactionsView({ transactions, onClose }: { transactions: any[]; onClose: () => void }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  return (
    <>
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {transactions.length > 0 ? (
          transactions.map((tx) => (
            <div key={tx.id} className="transaction-item" style={{ marginBottom: '12px', padding: '12px', border: '1px solid var(--gray-200)' }}>
              <div className="transaction-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <code style={{ fontSize: '11px', color: 'var(--gray-600)' }}>{tx.hash}</code>
                <span className={`transaction-status ${tx.successful ? 'success' : 'failed'}`}>
                  {tx.successful ? 'Success' : 'Failed'}
                </span>
              </div>
              <div className="transaction-meta" style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--gray-500)' }}>
                <span>Ledger: {tx.ledger}</span>
                <span>Operations: {tx.operationCount}</span>
                <span>{formatDate(tx.createdAt)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="info-message">No transactions found</p>
        )}
      </div>
      <div className="modal-actions" style={{ marginTop: '20px' }}>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </>
  )
}
