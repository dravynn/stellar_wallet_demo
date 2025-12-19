'use client'

import { useState, useEffect } from 'react'
import seedVault from '@/lib/services/seedVault'
import stellarWallet from '@/lib/services/stellarWallet'
import networkManager from '@/lib/services/networkManager'
import Modal from './Modal'
import AccountList from './AccountList'
import WalletDetails from './WalletDetails'
import NetworkSwitcher from './NetworkSwitcher'

export default function WalletApp() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const [modal, setModal] = useState<{ type: string; props?: any } | null>(null)
  const [networkKey, setNetworkKey] = useState(0) // Force re-render on network change

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleNetworkChange = () => {
    setNetworkKey(prev => prev + 1)
    showStatus(`Switched to ${networkManager.getCurrentNetwork().name}`, 'info')
    // Clear selected account to force reload with new network
    if (selectedAccountId) {
      const tempId = selectedAccountId
      setSelectedAccountId(null)
      setTimeout(() => setSelectedAccountId(tempId), 100)
    }
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1>Stellar Wallet</h1>
            <p className="subtitle">Seed Vault</p>
          </div>
          <NetworkSwitcher onNetworkChange={handleNetworkChange} />
        </div>
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
              key={networkKey}
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
            modal.type === 'receive' ? 'Receive Payment' :
            modal.type === 'secret' ? 'Secret Key' :
            modal.type === 'transactions' ? 'Transaction History' : 'Modal'
          }
        >
          {modal.type === 'create' && <CreateAccountForm onSubmit={modal.props.onSubmit} onCancel={() => setModal(null)} />}
          {modal.type === 'import' && <ImportAccountForm onSubmit={modal.props.onSubmit} onCancel={() => setModal(null)} />}
          {modal.type === 'confirm' && <ConfirmDialog message={modal.props.message} onConfirm={modal.props.onConfirm} onCancel={() => setModal(null)} />}
          {modal.type === 'send' && (
            <SendPaymentForm 
              accountId={modal.props.accountId} 
              balances={modal.props.balances || []} 
              onSubmit={async (data) => {
                try {
                  await modal.props.onSubmit(data)
                  setModal(null) // Close modal on success
                } catch (error) {
                  // Error already handled in onSubmit, keep modal open
                }
              }} 
              onCancel={() => setModal(null)} 
            />
          )}
          {modal.type === 'receive' && <ReceivePaymentView publicKey={modal.props.publicKey} accountName={modal.props.accountName} onClose={() => setModal(null)} />}
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

function SendPaymentForm({ accountId, balances, onSubmit, onCancel }: { 
  accountId: string
  balances: any[]
  onSubmit: (data: { destination: string; amount: number; asset: { code: string; issuer?: string } }) => void
  onCancel: () => void 
}) {
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<{ code: string; issuer?: string }>(() => {
    // Default to XLM if available, otherwise first balance
    const xlmBalance = balances.find(b => b.asset === 'XLM')
    if (xlmBalance) {
      return { code: 'XLM' }
    }
    return balances.length > 0 ? { 
      code: balances[0].asset, 
      issuer: balances[0].issuer 
    } : { code: 'XLM' }
  })
  const [errors, setErrors] = useState<{ destination?: string; amount?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateDestination = (addr: string): boolean => {
    // Stellar public keys start with G and are 56 characters
    return addr.startsWith('G') && addr.length === 56
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    
    const dest = destination.trim()
    const amountNum = parseFloat(amount)

    // Validation
    const newErrors: { destination?: string; amount?: string } = {}
    
    if (!dest) {
      newErrors.destination = 'Destination address is required'
    } else if (!validateDestination(dest)) {
      newErrors.destination = 'Invalid Stellar address (must start with G and be 56 characters)'
    }

    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Amount must be greater than 0'
    } else if (amountNum > maxAmount) {
      newErrors.amount = `Amount exceeds available balance (${maxAmount.toFixed(7)})`
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({ 
        destination: dest, 
        amount: amountNum,
        asset: selectedAsset
      })
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedBalance = balances.find(b => 
    b.asset === selectedAsset.code && 
    (!selectedAsset.issuer || b.issuer === selectedAsset.issuer)
  )

  const maxAmount = selectedBalance ? parseFloat(selectedBalance.balance) : 0
  const feeInXLM = 0.0000100 // Base fee
  const totalRequired = selectedAsset.code === 'XLM' ? parseFloat(amount || '0') + feeInXLM : parseFloat(amount || '0')

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="asset">Asset</label>
        <select
          id="asset"
          className="form-input"
          value={selectedAsset.code + (selectedAsset.issuer ? `:${selectedAsset.issuer}` : '')}
          onChange={(e) => {
            const value = e.target.value
            if (value === 'XLM') {
              setSelectedAsset({ code: 'XLM' })
            } else {
              const [code, issuer] = value.split(':')
              setSelectedAsset({ code, issuer })
            }
            setAmount('')
            setErrors({})
          }}
          required
          disabled={balances.length === 0}
        >
          {balances.length === 0 ? (
            <option value="">No balances available</option>
          ) : (
            balances.map((balance, idx) => (
              <option 
                key={idx} 
                value={balance.asset + (balance.issuer ? `:${balance.issuer}` : '')}
              >
                {balance.asset} {balance.issuer ? `(${balance.issuer.substring(0, 8)}...)` : ''} - {parseFloat(balance.balance).toFixed(7)}
              </option>
            ))
          )}
        </select>
        <small className="form-help">Select the asset to send</small>
      </div>

      <div className="form-group">
        <label htmlFor="destination">Destination Public Key</label>
        <input
          type="text"
          id="destination"
          className="form-input"
          placeholder="G..."
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value)
            if (errors.destination) {
              setErrors({ ...errors, destination: undefined })
            }
          }}
          required
          style={{ 
            borderColor: errors.destination ? 'var(--gray-800)' : undefined 
          }}
        />
        {errors.destination && (
          <small className="form-help" style={{ color: 'var(--gray-800)', display: 'block', marginTop: '4px' }}>
            {errors.destination}
          </small>
        )}
        <small className="form-help">Enter the recipient's Stellar public key (starts with G, 56 characters)</small>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Amount</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="number"
            id="amount"
            className="form-input"
            placeholder="10.5"
            step="0.0000001"
            min="0"
            max={maxAmount}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              if (errors.amount) {
                setErrors({ ...errors, amount: undefined })
              }
            }}
            required
            style={{ 
              flex: 1,
              borderColor: errors.amount ? 'var(--gray-800)' : undefined 
            }}
            disabled={maxAmount === 0}
          />
          <button
            type="button"
            className="btn btn-small btn-secondary"
            onClick={() => {
              // For XLM, reserve fee
              const max = selectedAsset.code === 'XLM' && maxAmount > feeInXLM 
                ? (maxAmount - feeInXLM).toFixed(7) 
                : maxAmount.toFixed(7)
              setAmount(max)
            }}
            disabled={maxAmount === 0}
          >
            Max
          </button>
        </div>
        {errors.amount && (
          <small className="form-help" style={{ color: 'var(--gray-800)', display: 'block', marginTop: '4px' }}>
            {errors.amount}
          </small>
        )}
        <small className="form-help">
          Available: {maxAmount.toFixed(7)} {selectedAsset.code}
          {selectedAsset.code === 'XLM' && maxAmount > feeInXLM && (
            <span> (Fee: {feeInXLM} XLM will be deducted)</span>
          )}
        </small>
      </div>

      <div className="form-group">
        <div style={{ 
          padding: '12px', 
          background: 'var(--gray-50)', 
          border: '1px solid var(--gray-200)',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Transaction Fee:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>0.0000100 XLM</span>
          </div>
          {selectedAsset.code === 'XLM' && amount && parseFloat(amount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--gray-200)' }}>
              <span>Total Required:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {totalRequired.toFixed(7)} XLM
              </span>
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '4px' }}>
            Network fee (100 stroops) will be deducted from your XLM balance
          </div>
        </div>
      </div>

      <div className="modal-actions">
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={isSubmitting || balances.length === 0 || maxAmount === 0}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </button>
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

function ReceivePaymentView({ publicKey, accountName, onClose }: { publicKey: string; accountName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicKey)}`

  return (
    <>
      <div style={{ marginBottom: '20px' }}>
        <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--gray-600)' }}>
          Share your public key to receive payments. Anyone can send tokens to this address.
        </p>
        
        <div style={{ 
          background: 'var(--gray-50)', 
          padding: '20px', 
          border: '1px solid var(--gray-200)',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <img 
              src={qrCodeUrl} 
              alt="QR Code" 
              style={{ 
                border: '1px solid var(--gray-300)',
                padding: '8px',
                background: 'var(--white)'
              }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '11px', 
              color: 'var(--gray-500)', 
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Account Name
            </label>
            <div style={{ fontWeight: 500, fontSize: '16px' }}>{accountName}</div>
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '11px', 
              color: 'var(--gray-500)', 
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Public Key
            </label>
            <code className="public-key" style={{ 
              display: 'block', 
              padding: '12px', 
              wordBreak: 'break-all',
              fontSize: '12px',
              marginBottom: '12px'
            }}>
              {publicKey}
            </code>
            <button 
              className={`btn ${copied ? 'btn-primary' : 'btn-secondary'}`}
              onClick={copyToClipboard}
              style={{ width: '100%' }}
            >
              {copied ? '✓ Copied!' : 'Copy Public Key'}
            </button>
          </div>
        </div>

        <div style={{ 
          padding: '12px', 
          background: 'var(--gray-50)', 
          border: '1px solid var(--gray-200)',
          fontSize: '12px',
          color: 'var(--gray-600)'
        }}>
          <strong>Note:</strong> This address can receive any Stellar asset (XLM and tokens). Make sure the sender uses the correct network (Testnet or Mainnet).
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </>
  )
}

function TransactionsView({ transactions, onClose }: { transactions: any[]; onClose: () => void }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const formatFee = (fee: string | undefined) => {
    if (!fee) return 'N/A'
    const feeInXLM = (parseInt(fee) / 10000000).toFixed(7)
    return `${feeInXLM} XLM`
  }

  return (
    <>
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {transactions.length > 0 ? (
          transactions.map((tx) => (
            <div key={tx.id} className="transaction-item" style={{ marginBottom: '12px', padding: '12px', border: '1px solid var(--gray-200)' }}>
              <div className="transaction-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <code style={{ fontSize: '11px', color: 'var(--gray-600)' }}>{tx.hash.substring(0, 16)}...</code>
                <span className={`transaction-status ${tx.successful ? 'success' : 'failed'}`}>
                  {tx.successful ? 'Success' : 'Failed'}
                </span>
              </div>
              <div className="transaction-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px' }}>
                <span>Ledger: {tx.ledger}</span>
                <span>Operations: {tx.operationCount}</span>
                <span>{formatDate(tx.createdAt)}</span>
              </div>
              {(tx.feePaid || tx.feeCharged) && (
                <div style={{ fontSize: '11px', color: 'var(--gray-600)', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--gray-200)' }}>
                  <strong>Fee:</strong> {formatFee(tx.feePaid || tx.feeCharged)}
                </div>
              )}
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
