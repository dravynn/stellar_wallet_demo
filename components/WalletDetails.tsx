'use client'

import { useState, useEffect } from 'react'
import seedVault from '@/lib/services/seedVault'
import stellarWallet from '@/lib/services/stellarWallet'
import networkManager from '@/lib/services/networkManager'
import type { AccountDetails, Transaction } from '@/lib/services/stellarWallet'

// Force refresh when network changes
let lastNetworkType: string | null = null

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
      // Check if network changed
      const currentNetworkType = networkManager.getCurrentNetworkType()
      if (lastNetworkType !== null && lastNetworkType !== currentNetworkType) {
        console.log('Network changed, reloading account...')
      }
      lastNetworkType = currentNetworkType
      
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

      // Log for debugging
      const currentNetwork = networkManager.getCurrentNetwork()
      console.log('Loading account on network:', currentNetwork.name, 'Public Key:', publicKey)

      const details = await stellarWallet.loadAccount(publicKey)
      console.log('Account details loaded:', details)
      
      setAccountDetails(details)

      if (!details.isNewAccount) {
        try {
          const txs = await stellarWallet.getTransactions(publicKey, 5)
          setTransactions(txs)
        } catch (err) {
          console.error('Error loading transactions:', err)
        }
      } else {
        console.log('Account appears to be new. If you funded it, make sure you are on the correct network (Testnet)')
      }
    } catch (error: any) {
      console.error('Error loading account:', error)
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
    if (!accountId || !onShowModal || !accountDetails) return
    
    // Check if account has any balances
    if (accountDetails.balances.length === 0) {
      onStatus('No balances available to send', 'error')
      return
    }

    onShowModal('send', {
      accountId,
      balances: accountDetails.balances,
      onSubmit: async (data: { destination: string; amount: number; asset: { code: string; issuer?: string } }) => {
        try {
          const secretKey = seedVault.getSecretKey(accountId)
          if (!secretKey) {
            throw new Error('Secret key not found')
          }

          const keypair = stellarWallet.getKeypairFromSecret(secretKey)
          
          // Validate destination address
          if (!data.destination.startsWith('G') || data.destination.length !== 56) {
            throw new Error('Invalid destination address')
          }

          // Check balance
          const selectedBalance = accountDetails.balances.find(b => 
            b.asset === data.asset.code && 
            (!data.asset.issuer || b.issuer === data.asset.issuer)
          )

          if (!selectedBalance) {
            throw new Error(`Balance not found for ${data.asset.code}`)
          }

          const availableBalance = parseFloat(selectedBalance.balance)
          if (data.amount > availableBalance) {
            throw new Error(`Insufficient balance. Available: ${availableBalance.toFixed(7)}`)
          }

          // For XLM, check if there's enough for fee
          if (data.asset.code === 'XLM') {
            const xlmBalance = accountDetails.balances.find(b => b.asset === 'XLM')
            const xlmAvailable = xlmBalance ? parseFloat(xlmBalance.balance) : 0
            const feeRequired = 0.0000100
            if (data.amount + feeRequired > xlmAvailable) {
              throw new Error(`Insufficient XLM for amount + fee. Need ${(data.amount + feeRequired).toFixed(7)} XLM`)
            }
          }

          onStatus('Sending payment...', 'info')
          const result = await stellarWallet.createPayment(keypair, data.destination, data.amount, data.asset)
          onStatus(`Payment sent successfully! Fee: ${result.feeInfo.feeInXLM} XLM`, 'success')
          
          // Close modal and refresh
          setTimeout(() => {
            loadAccountDetails()
          }, 1500)
        } catch (error: any) {
          onStatus(`Error: ${error.message}`, 'error')
          throw error // Re-throw to prevent modal from closing
        }
      }
    })
  }

  const handleReceivePayment = () => {
    if (!accountId || !onShowModal) return
    
    const account = seedVault.getAccount(accountId)
    if (!account) return

    const secretKey = seedVault.getSecretKey(accountId)
    if (!secretKey) return

    const keypair = stellarWallet.getKeypairFromSecret(secretKey)
    const publicKey = keypair.publicKey()

    onShowModal('receive', {
      publicKey,
      accountName: account.name
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
      const txs = await stellarWallet.getTransactions(publicKey, 50, true) // Load with operations
      onShowModal('transactions', { 
        transactions: txs,
        publicKey: publicKey
      })
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
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--gray-200)' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '0.95em', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</h4>
            {isTestnet ? (
              <>
                <p className="info-message" style={{ marginBottom: '16px' }}>This account hasn't been funded yet. Click the button below to fund it on the testnet.</p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={handleFundAccount}>Fund Testnet Account</button>
                  <button className="btn btn-secondary" onClick={handleReceivePayment}>Receive</button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleSendPayment}
                    disabled={true}
                    title="Fund account first to enable sending"
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="error-message" style={{ marginBottom: '16px' }}>
                  <p><strong>⚠️ Mainnet Account</strong></p>
                  <p style={{ marginTop: '8px', fontSize: '13px' }}>
                    This account is on mainnet. You need to fund it with real XLM from an exchange or another account. Friendbot funding is only available on testnet.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={handleReceivePayment}>Receive</button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleSendPayment}
                    disabled={true}
                    title="Fund account first to enable sending"
                  >
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <span className="status-badge" style={{ 
              background: isTestnet ? 'var(--white)' : 'var(--black)', 
              color: isTestnet ? 'var(--gray-600)' : 'var(--white)',
              borderColor: isTestnet ? 'var(--gray-400)' : 'var(--black)'
            }}>
              {currentNetwork.name}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--gray-500)', fontFamily: 'monospace' }}>
              ({currentNetwork.horizonUrl.includes('testnet') ? 'TESTNET' : 'MAINNET'})
            </span>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h4>Balances</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-small btn-primary" 
                onClick={handleSendPayment}
                disabled={accountDetails.balances.length === 0}
                title={accountDetails.balances.length === 0 ? 'No balances available' : 'Send payment'}
              >
                Send
              </button>
              <button 
                className="btn btn-small btn-secondary" 
                onClick={handleReceivePayment}
                title="Receive payment"
              >
                Receive
              </button>
            </div>
          </div>
          {accountDetails.balances.length > 0 ? (
            <div className="balances-list">
              {accountDetails.balances.map((balance, idx) => (
                <div key={idx} className="balance-item">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className="balance-asset">
                      {balance.asset}
                      {balance.issuer && (
                        <span style={{ fontSize: '10px', color: 'var(--gray-500)', marginLeft: '8px' }}>
                          ({balance.issuer.substring(0, 8)}...)
                        </span>
                      )}
                    </span>
                    {balance.limit && (
                      <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                        Limit: {parseFloat(balance.limit).toFixed(7)}
                      </span>
                    )}
                  </div>
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
              {transactions.map((tx) => {
                const fee = tx.feePaid || tx.feeCharged
                const feeInXLM = fee ? (parseInt(fee) / 10000000).toFixed(7) : null
                const explorerUrl = networkManager.getCurrentNetwork().type === 'testnet'
                  ? `https://stellar.expert/explorer/testnet/tx/${tx.hash}`
                  : `https://stellar.expert/explorer/public/tx/${tx.hash}`
                
                return (
                  <div key={tx.id} className="transaction-item" style={{ cursor: 'pointer' }} onClick={() => {
                    if (onShowModal) {
                      onShowModal('transactions', { 
                        transactions: [tx],
                        publicKey: publicKey
                      })
                    }
                  }}>
                    <div className="transaction-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="transaction-id">{tx.hash.substring(0, 12)}...</span>
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: '10px', color: 'var(--gray-500)', textDecoration: 'none' }}
                        >
                          ↗
                        </a>
                      </div>
                      <span className={`transaction-status ${tx.successful ? 'success' : 'failed'}`}>
                        {tx.successful ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <div className="transaction-meta">
                      <span>Ledger: {tx.ledger}</span>
                      <span>Ops: {tx.operationCount}</span>
                      {feeInXLM && <span>Fee: {feeInXLM} XLM</span>}
                      <span>{new Date(tx.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                )
              })}
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
          <button className="btn btn-primary" onClick={loadAccountDetails} style={{ minWidth: '120px' }}>
            🔄 Refresh Account
          </button>
          <button className="btn btn-secondary" onClick={handleViewSecretKey}>View Secret Key</button>
        </div>
        {accountDetails.isNewAccount && (
          <div style={{ 
            marginTop: '20px', 
            padding: '16px', 
            background: 'var(--gray-50)', 
            border: '1px solid var(--gray-300)',
            fontSize: '13px'
          }}>
            <p style={{ marginBottom: '8px', fontWeight: 500 }}>
              ⚠️ Account appears unfunded
            </p>
            <p style={{ marginBottom: '8px', color: 'var(--gray-600)' }}>
              If you funded this account externally, please:
            </p>
            <ul style={{ marginLeft: '20px', color: 'var(--gray-600)', marginBottom: '8px' }}>
              <li>Verify you are on <strong>{currentNetwork.name}</strong> network (check the network switcher in header)</li>
              <li>Click "Refresh Account" button above</li>
              <li>Wait a few seconds for the network to sync</li>
            </ul>
            <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
              Current Network: <strong>{currentNetwork.name}</strong> | Horizon: {currentNetwork.horizonUrl}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
