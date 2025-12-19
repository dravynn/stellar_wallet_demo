'use client'

import { useState, useEffect } from 'react'
import seedVault from '@/lib/services/seedVault'
import stellarWallet from '@/lib/services/stellarWallet'
import networkManager from '@/lib/services/networkManager'
import type { AccountDetails, Transaction } from '@/lib/services/stellarWallet'

interface WalletDetailsProps {
  accountId: string | null
  onStatus: (message: string, type: 'info' | 'success' | 'error') => void
  onRefresh: () => void
  onShowModal?: (type: string, props?: any) => void
}

export default function WalletDetails({ accountId, onStatus, onRefresh, onShowModal }: WalletDetailsProps) {
  const [accountDetails, setAccountDetails] = useState<AccountDetails | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    if (accountId) {
      loadAccountDetails()
    } else {
      setAccountDetails(null)
      setTransactions([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  const loadAccountDetails = async () => {
    if (!accountId) return

    setLoading(true)
    try {
      const account = seedVault.getAccount(accountId)
      if (!account) return

      const secretKey = seedVault.getSecretKey(accountId)
      if (!secretKey) return

      const keypair = stellarWallet.getKeypairFromSecret(secretKey)
      const publicKey = keypair.publicKey()

      const details = await stellarWallet.loadAccount(publicKey)
      setAccountDetails(details)

      if (!details.isNewAccount) {
        try {
          const txs = await stellarWallet.getTransactions(publicKey, 5)
          setTransactions(txs)
        } catch (err) {
          console.error('Error loading transactions:', err)
        }
      }
    } catch (error: any) {
      onStatus(`Error loading account: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFundAccount = async () => {
    if (!accountId) return

    const account = seedVault.getAccount(accountId)
    if (!account) return

    const secretKey = seedVault.getSecretKey(accountId)
    if (!secretKey) return

    const keypair = stellarWallet.getKeypairFromSecret(secretKey)
    const publicKey = keypair.publicKey()

    try {
      onStatus('Funding account on testnet...', 'info')
      await stellarWallet.fundTestnetAccount(publicKey)
      onStatus('Account funded successfully!', 'success')
      setTimeout(() => {
        loadAccountDetails()
      }, 2000)
    } catch (error: any) {
      onStatus(`Error funding account: ${error.message}`, 'error')
    }
  }

  const handleSendPayment = () => {
    if (!accountId || !onShowModal) return
    onShowModal('send', {
      accountId,
      onSubmit: async (data: { destination: string; amount: number }) => {
        try {
          const secretKey = seedVault.getSecretKey(accountId)
          if (!secretKey) return

          const keypair = stellarWallet.getKeypairFromSecret(secretKey)
          onStatus('Sending payment...', 'info')
          await stellarWallet.createPayment(keypair, data.destination, data.amount)
          onStatus('Payment sent successfully!', 'success')
          setTimeout(() => {
            loadAccountDetails()
          }, 1500)
        } catch (error: any) {
          onStatus(`Error: ${error.message}`, 'error')
        }
      }
    })
  }

  const handleViewSecretKey = () => {
    if (!accountId || !onShowModal) return
    const secretKey = seedVault.getSecretKey(accountId)
    if (secretKey) {
      onShowModal('secret', { secretKey })
    }
  }

  const handleViewAllTransactions = async () => {
    if (!accountId || !onShowModal) return

    const account = seedVault.getAccount(accountId)
    if (!account) return

    const secretKey = seedVault.getSecretKey(accountId)
    if (!secretKey) return

    const keypair = stellarWallet.getKeypairFromSecret(secretKey)
    const publicKey = keypair.publicKey()

    try {
      onStatus('Loading transactions...', 'info')
      const txs = await stellarWallet.getTransactions(publicKey, 20)
      onShowModal('transactions', { transactions: txs })
    } catch (error: any) {
      onStatus(`Error loading transactions: ${error.message}`, 'error')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      onStatus('Copied to clipboard!', 'success')
    }).catch(() => {
      onStatus('Failed to copy', 'error')
    })
  }

  if (!accountId) {
    return <p className="info-message">Select an account from the vault to view wallet details</p>
  }

  if (loading) {
    return <div className="loading">Loading account details...</div>
  }

  if (!accountDetails) {
    return <div className="error-message"><p>Error loading account</p></div>
  }

  const account = seedVault.getAccount(accountId)
  if (!account) return null

  const secretKey = seedVault.getSecretKey(accountId)
  if (!secretKey) return null

  const keypair = stellarWallet.getKeypairFromSecret(secretKey)
  const publicKey = keypair.publicKey()

  const totalXLM = accountDetails.balances.find(b => b.asset === 'XLM')
  const xlmBalance = totalXLM ? parseFloat(totalXLM.balance) : 0
  const isTestnet = networkManager.isTestnet()
  const currentNetwork = networkManager.getCurrentNetwork()

  if (accountDetails.isNewAccount) {
    return (
      <div className="account-details">
        <h3>{account.name}</h3>
        <div className="account-info">
          <div className="info-row">
            <label>Network:</label>
            <span className="status-badge" style={{ 
              background: isTestnet ? 'var(--white)' : 'var(--black)', 
              color: isTestnet ? 'var(--gray-600)' : 'var(--white)',
              borderColor: isTestnet ? 'var(--gray-400)' : 'var(--black)'
            }}>
              {currentNetwork.name}
            </span>
          </div>
          <div className="info-row">
            <label>Public Key:</label>
            <code className="public-key">{publicKey}</code>
            <button className="btn btn-small" onClick={() => copyToClipboard(publicKey)}>Copy</button>
          </div>
          <div className="info-row">
            <label>Status:</label>
            <span className="status-badge new">New Account</span>
          </div>
          <div className="info-row">
            <label>Secret Key:</label>
            <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
              {showSecret ? (
                <code className="public-key" style={{ flex: 1 }}>{secretKey}</code>
              ) : (
                <span style={{ flex: 1 }}>••••••••••••••••</span>
              )}
              <button className="btn btn-small" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? 'Hide' : 'Show'}
              </button>
              <button className="btn btn-small" onClick={() => copyToClipboard(secretKey)}>Copy</button>
            </div>
          </div>
          {isTestnet ? (
            <>
              <p className="info-message">This account hasn't been funded yet. Click the button below to fund it on the testnet.</p>
              <button className="btn btn-primary" onClick={handleFundAccount}>Fund Testnet Account</button>
            </>
          ) : (
            <div className="error-message" style={{ marginTop: '16px' }}>
              <p><strong>⚠️ Mainnet Account</strong></p>
              <p style={{ marginTop: '8px', fontSize: '13px' }}>
                This account is on mainnet. You need to fund it with real XLM from an exchange or another account. Friendbot funding is only available on testnet.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="account-details">
      <h3>{account.name}</h3>
      <div className="account-info">
        <div className="info-row">
          <label>Network:</label>
          <span className="status-badge" style={{ 
            background: isTestnet ? 'var(--white)' : 'var(--black)', 
            color: isTestnet ? 'var(--gray-600)' : 'var(--white)',
            borderColor: isTestnet ? 'var(--gray-400)' : 'var(--black)'
          }}>
            {currentNetwork.name}
          </span>
        </div>
        <div className="info-row">
          <label>Public Key:</label>
          <code className="public-key">{publicKey}</code>
          <button className="btn btn-small" onClick={() => copyToClipboard(publicKey)}>Copy</button>
        </div>
        <div className="info-row">
          <label>Status:</label>
          <span className="status-badge active">Active</span>
        </div>
        <div className="balances-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4>Balances</h4>
            {xlmBalance > 0 && (
              <button className="btn btn-small btn-primary" onClick={handleSendPayment}>Send Payment</button>
            )}
          </div>
          {accountDetails.balances.length > 0 ? (
            <div className="balances-list">
              {accountDetails.balances.map((balance, idx) => (
                <div key={idx} className="balance-item">
                  <span className="balance-asset">{balance.asset}</span>
                  <span className="balance-amount">{parseFloat(balance.balance).toFixed(7)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="info-message">No balances found</p>
          )}
        </div>
        {transactions.length > 0 && (
          <div className="transactions-section">
            <h4>Recent Transactions</h4>
            <div className="transactions-list">
              {transactions.map((tx) => (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-header">
                    <span className="transaction-id">{tx.hash.substring(0, 8)}...</span>
                    <span className={`transaction-status ${tx.successful ? 'success' : 'failed'}`}>
                      {tx.successful ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div className="transaction-meta">
                    <span>Ledger: {tx.ledger}</span>
                    <span>{new Date(tx.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-small btn-secondary" onClick={handleViewAllTransactions} style={{ marginTop: '12px' }}>
              View All Transactions
            </button>
          </div>
        )}
        <div className="account-meta">
          <div className="meta-item">
            <label>Sequence Number:</label>
            <span>{accountDetails.sequenceNumber}</span>
          </div>
          <div className="meta-item">
            <label>Subentry Count:</label>
            <span>{accountDetails.subentryCount}</span>
          </div>
        </div>
        <div className="wallet-actions">
          <button className="btn btn-secondary" onClick={loadAccountDetails}>Refresh</button>
          <button className="btn btn-secondary" onClick={handleViewSecretKey}>View Secret Key</button>
        </div>
      </div>
    </div>
  )
}
