import * as StellarSdk from '@stellar/stellar-sdk';
import networkManager, { NetworkConfig } from './networkManager';

export interface Balance {
  asset: string;
  assetType: string;
  balance: string;
  limit?: string;
  issuer?: string;
}

export interface AccountDetails {
  accountId: string;
  balances: Balance[];
  sequenceNumber: string;
  subentryCount: number;
  isNewAccount?: boolean;
  message?: string;
}

export interface Transaction {
  id: string;
  hash: string;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  operationCount: number;
  successful: boolean;
}

/**
 * Stellar Wallet Service
 * Handles Stellar account operations
 */
class StellarWallet {
  /**
   * Get current Horizon server instance
   */
  private getServer(): any {
    return networkManager.getHorizonServer();
  }

  /**
   * Get current network passphrase
   */
  private getNetworkPassphrase(): string {
    return networkManager.getNetworkPassphrase();
  }

  /**
   * Create a new Stellar account
   */
  async createAccount() {
    const keypair = StellarSdk.Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
      keypair: keypair
    };
  }

  /**
   * Get account from secret key
   */
  getKeypairFromSecret(secretKey: string): any {
    try {
      return StellarSdk.Keypair.fromSecret(secretKey);
    } catch (error) {
      throw new Error('Invalid secret key');
    }
  }

  /**
   * Load account details from the network
   */
  async loadAccount(publicKey: string): Promise<AccountDetails> {
    try {
      const server = this.getServer();
      const account = await server.loadAccount(publicKey);
      return {
        accountId: account.accountId(),
        balances: account.balances().map((balance: any) => ({
          asset: balance.asset_type === 'native' ? 'XLM' : balance.asset_code,
          assetType: balance.asset_type,
          balance: balance.balance,
          limit: balance.limit,
          issuer: balance.asset_issuer
        })),
        sequenceNumber: account.sequenceNumber(),
        subentryCount: account.subentryCount(),
      };
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return {
          accountId: publicKey,
          balances: [],
          sequenceNumber: '0',
          subentryCount: 0,
          isNewAccount: true,
          message: 'Account not found on network. Fund it to activate.'
        };
      }
      throw error;
    }
  }

  /**
   * Fund account on testnet (friendbot)
   */
  async fundTestnetAccount(publicKey: string) {
    const network = networkManager.getCurrentNetwork();
    
    if (!network.friendbotUrl) {
      throw new Error('Friendbot is only available on testnet');
    }

    try {
      const response = await fetch(
        `${network.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
      );
      const data = await response.json();
      console.log("fundTestnetAccount data", data);
      return data;
    } catch (error) {
      throw new Error('Failed to fund testnet account');
    }
  }

  /**
   * Create a payment transaction
   */
  async createPayment(sourceKeypair: any, destinationPublicKey: string, amount: number, asset: string = 'XLM') {
    try {
      const server = this.getServer();
      const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());
      
      let paymentAsset: any;
      if (asset === 'XLM') {
        paymentAsset = StellarSdk.Asset.native();
      } else {
        throw new Error('Custom assets not implemented in this demo');
      }

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.getNetworkPassphrase()
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationPublicKey,
            asset: paymentAsset,
            amount: amount.toString()
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(sourceKeypair);
      
      const result = await server.submitTransaction(transaction);
      return result;
    } catch (error: any) {
      throw new Error(`Payment failed: ${error.message}`);
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(publicKey: string, limit: number = 10): Promise<Transaction[]> {
    try {
      const server = this.getServer();
      const transactions = await server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(limit)
        .call();

      return transactions.records.map((tx: any) => ({
        id: tx.id,
        hash: tx.hash,
        ledger: tx.ledger,
        createdAt: tx.created_at,
        sourceAccount: tx.source_account,
        operationCount: tx.operation_count,
        successful: tx.successful
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
  }
}

export default new StellarWallet();
