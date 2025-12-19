'use client'

interface Account {
  id: string
  name: string
  createdAt: string
}

interface AccountListProps {
  accounts: Account[]
  selectedAccountId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export default function AccountList({ accounts, selectedAccountId, onSelect, onRemove }: AccountListProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  if (accounts.length === 0) {
    return (
      <p className="empty-message">
        No accounts in vault. Create or import an account to get started.
      </p>
    )
  }

  return (
    <div className="accounts-list">
      {accounts.map((account) => (
        <div
          key={account.id}
          className={`account-item ${selectedAccountId === account.id ? 'selected' : ''}`}
          onClick={() => onSelect(account.id)}
        >
          <div className="account-header">
            <h3>{account.name}</h3>
            <span className="account-date">{formatDate(account.createdAt)}</span>
          </div>
          <div className="account-actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-small btn-primary" onClick={() => onSelect(account.id)}>
              View
            </button>
            <button className="btn btn-small btn-danger" onClick={() => onRemove(account.id)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
