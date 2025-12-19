import * as StellarSdk from '@stellar/stellar-sdk';
import networkManager, { NetworkConfig } from './networkManager';

export interface Balance {
  asset: string;
  assetType: string;
  balance: string;
  limit?: string;
  issuer?: string;
}

export interface PaymentAsset {
  code: string;
  issuer?: string;
}

export interface FeeInfo {
  baseFee: string;
  operationFee: string;
  totalFee: string;
  feeInXLM: string;
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
  feePaid?: string;
  feeCharged?: string;
  memo?: string;
  memoType?: string;
  operations?: TransactionOperation[];
}

export interface TransactionOperation {
  id: string;
  type: string;
  sourceAccount?: string;
  assetCode?: string;
  assetIssuer?: string;
  amount?: string;
  from?: string;
  to?: string;
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
      const network = networkManager.getCurrentNetwork();
      
      console.log(`Loading account ${publicKey} from ${network.horizonUrl}`);
      
      const account = await server.loadAccount(publicKey);
      
      // account.balances is a property (array), not a function
      const balances = (account.balances || []).map((balance: any) => ({
        asset: balance.asset_type === 'native' ? 'XLM' : balance.asset_code,
        assetType: balance.asset_type,
        balance: balance.balance,
        limit: balance.limit,
        issuer: balance.asset_issuer
      }));
      
      console.log(`Account loaded successfully. Balances:`, balances);
      console.log(`Account details:`, {
        accountId: account.accountId(),
        sequenceNumber: account.sequenceNumber(),
        subentryCount: account.subentryCount()
      });
      
      return {
        accountId: account.accountId(),
        balances,
        sequenceNumber: account.sequenceNumber(),
        subentryCount: account.subentryCount(),
      };
    } catch (error: any) {
      console.error('Error loading account:', error);
      
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.statusText);
      }
      
      if (error.response && error.response.status === 404) {
        const network = networkManager.getCurrentNetwork();
        console.log(`Account not found on ${network.name}. This might mean:`);
        console.log(`1. Account hasn't been funded yet`);
        console.log(`2. You're checking the wrong network (currently: ${network.name})`);
        console.log(`3. Account was funded on a different network`);
        
        return {
          accountId: publicKey,
          balances: [],
          sequenceNumber: '0',
          subentryCount: 0,
          isNewAccount: true,
          message: `Account not found on ${network.name}. Make sure you're on the correct network.`
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
   * Calculate transaction fee
   */
  calculateFee(operationCount: number = 1): FeeInfo {
    const baseFee = StellarSdk.BASE_FEE;
    const operationFee = (baseFee * operationCount).toString();
    const totalFee = operationFee;
    
    return {
      baseFee: baseFee.toString(),
      operationFee,
      totalFee,
      feeInXLM: (parseInt(totalFee) / 10000000).toFixed(7) // Convert stroops to XLM
    };
  }

  /**
   * Create payment asset from balance
   */
  createAssetFromBalance(balance: Balance): any {
    if (balance.asset === 'XLM' || balance.assetType === 'native') {
      return StellarSdk.Asset.native();
    } else {
      if (!balance.issuer) {
        throw new Error('Issuer required for custom assets');
      }
      return new StellarSdk.Asset(balance.asset, balance.issuer);
    }
  }

  /**
   * Create a payment transaction
   */
  async createPayment(
    sourceKeypair: any, 
    destinationPublicKey: string, 
    amount: number, 
    asset: PaymentAsset
  ) {
    try {
      const server = this.getServer();
      const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());
      
      let paymentAsset: any;
      if (asset.code === 'XLM' || !asset.issuer) {
        paymentAsset = StellarSdk.Asset.native();
      } else {
        paymentAsset = new StellarSdk.Asset(asset.code, asset.issuer);
      }

      const feeInfo = this.calculateFee(1);

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: feeInfo.baseFee,
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
      return {
        ...result,
        feeInfo
      };
    } catch (error: any) {
      throw new Error(`Payment failed: ${error.message}`);
    }
  }

  /**
   * Get transaction history with operations
   */
  async getTransactions(publicKey: string, limit: number = 10, includeOperations: boolean = false): Promise<Transaction[]> {
    try {
      const server = this.getServer();
      const network = networkManager.getCurrentNetwork();
      
      const transactions = await server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(limit)
        .call();

      const result: Transaction[] = [];

      for (const tx of transactions.records) {
        const transaction: Transaction = {
          id: tx.id,
          hash: tx.hash,
          ledger: tx.ledger,
          createdAt: tx.created_at,
          sourceAccount: tx.source_account,
          operationCount: tx.operation_count,
          successful: tx.successful,
          feePaid: tx.fee_paid,
          feeCharged: tx.fee_charged,
          memo: tx.memo,
          memoType: tx.memo_type
        };

        // Load operations if requested
        if (includeOperations) {
          try {
            const operations = await server
              .operations()
              .forTransaction(tx.hash)
              .call();

            transaction.operations = operations.records.map((op: any) => ({
              id: op.id,
              type: op.type,
              sourceAccount: op.source_account,
              assetCode: op.asset_code,
              assetIssuer: op.asset_issuer,
              amount: op.amount,
              from: op.from,
              to: op.to
            }));
          } catch (err) {
            console.error('Error loading operations:', err);
          }
        }

        result.push(transaction);
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
  }

  /**
   * Get transaction explorer URL
   */
  getTransactionExplorerUrl(hash: string): string {
    const network = networkManager.getCurrentNetwork();
    const explorerBase = network.type === 'testnet' 
      ? 'https://stellar.expert/explorer/testnet/tx'
      : 'https://stellar.expert/explorer/public/tx';
    return `${explorerBase}/${hash}`;
  }
}

export default new StellarWallet();
