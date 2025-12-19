'use client'

import { useState, useEffect } from 'react'
import networkManager, { NetworkType } from '@/lib/services/networkManager'

interface NetworkSwitcherProps {
  onNetworkChange?: () => void
}

export default function NetworkSwitcher({ onNetworkChange }: NetworkSwitcherProps) {
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>('testnet')
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Only read from localStorage after component mounts on client
    setMounted(true)
    setCurrentNetwork(networkManager.getCurrentNetworkType())
  }, [])

  const handleNetworkSwitch = (networkType: NetworkType) => {
    networkManager.switchNetwork(networkType)
    setCurrentNetwork(networkType)
    setIsOpen(false)
    if (onNetworkChange) {
      onNetworkChange()
    }
  }

  // Use default during SSR to prevent hydration mismatch
  const networkConfig = mounted ? networkManager.getCurrentNetwork() : { name: 'Testnet' }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-secondary"
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <span>Network: {networkConfig.name}</span>
        <span style={{ fontSize: '10px' }}>▼</span>
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '8px',
              background: 'var(--white)',
              border: '1px solid var(--black)',
              zIndex: 1000,
              minWidth: '200px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--gray-200)',
                fontWeight: 500,
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--gray-600)'
              }}
            >
              Select Network
            </div>
            <div
              className={`network-option ${currentNetwork === 'testnet' ? 'active' : ''}`}
              onClick={() => handleNetworkSwitch('testnet')}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--gray-200)',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (currentNetwork !== 'testnet') {
                  e.currentTarget.style.background = 'var(--gray-50)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--white)'
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>Testnet</div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                For testing and development
              </div>
            </div>
            <div
              className={`network-option ${currentNetwork === 'mainnet' ? 'active' : ''}`}
              onClick={() => handleNetworkSwitch('mainnet')}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (currentNetwork !== 'mainnet') {
                  e.currentTarget.style.background = 'var(--gray-50)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--white)'
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>Mainnet</div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                Production network - Real XLM
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
