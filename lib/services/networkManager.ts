import * as StellarSdk from '@stellar/stellar-sdk';

export type NetworkType = 'testnet' | 'mainnet';

export interface NetworkConfig {
  type: NetworkType;
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl?: string;
  name: string;
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  testnet: {
    type: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: StellarSdk.Networks.TESTNET,
    friendbotUrl: 'https://friendbot.stellar.org',
    name: 'Testnet'
  },
  mainnet: {
    type: 'mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    name: 'Mainnet'
  }
};

const STORAGE_KEY = 'stellar_network_preference';

class NetworkManager {
  private currentNetwork: NetworkType = 'testnet';

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadNetworkPreference();
    }
  }

  /**
   * Load network preference from localStorage
   */
  private loadNetworkPreference(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (stored === 'testnet' || stored === 'mainnet')) {
        this.currentNetwork = stored as NetworkType;
      }
    } catch (error) {
      console.error('Error loading network preference:', error);
    }
  }

  /**
   * Get current network configuration
   */
  getCurrentNetwork(): NetworkConfig {
    return NETWORKS[this.currentNetwork];
  }

  /**
   * Get current network type
   */
  getCurrentNetworkType(): NetworkType {
    return this.currentNetwork;
  }

  /**
   * Switch to a different network
   */
  switchNetwork(networkType: NetworkType): void {
    if (!NETWORKS[networkType]) {
      throw new Error(`Invalid network type: ${networkType}`);
    }

    this.currentNetwork = networkType;
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, networkType);
      } catch (error) {
        console.error('Error saving network preference:', error);
      }
    }
  }

  /**
   * Check if current network is testnet
   */
  isTestnet(): boolean {
    return this.currentNetwork === 'testnet';
  }

  /**
   * Check if current network is mainnet
   */
  isMainnet(): boolean {
    return this.currentNetwork === 'mainnet';
  }

  /**
   * Get Horizon server instance for current network
   */
  getHorizonServer(): any {
    const config = this.getCurrentNetwork();
    return new StellarSdk.Horizon.Server(config.horizonUrl);
  }

  /**
   * Get network passphrase for current network
   */
  getNetworkPassphrase(): string {
    return this.getCurrentNetwork().networkPassphrase;
  }
}

export default new NetworkManager();
