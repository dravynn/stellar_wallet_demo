# Stellar Wallet Demo - Seed Vault

A secure Next.js demo application for managing Stellar accounts with encrypted seed storage.

## Features

- 🔐 **Secure Seed Vault**: Encrypted storage of Stellar account seeds using AES encryption
- 🌟 **Account Management**: Create new Stellar accounts or import existing ones
- 💰 **Wallet Operations**: View account balances, transaction history, and account details
- 🧪 **Testnet Integration**: Built-in testnet funding via Friendbot
- 🎨 **Modern UI**: Clean, minimalist black and white design
- ⚛️ **Next.js**: Built with Next.js 14 and React

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## Usage

### Creating an Account

1. Click "Create New Account" button
2. Enter a name for your account
3. A new Stellar keypair will be generated
4. The account will be stored encrypted in your browser's localStorage

### Importing an Account

1. Click "Import Account" button
2. Enter a name and your existing secret key (starts with 'S')
3. The account will be added to your vault

### Viewing Wallet Details

1. Click on any account in the vault or click the "View" button
2. See account balances, public key, and account metadata
3. For new accounts, use the "Fund Testnet Account" button to activate

### Sending Payments

1. Select an account with XLM balance
2. Click "Send Payment" button
3. Enter destination public key and amount
4. Confirm the transaction

### Security Notes

⚠️ **Important**: This is a demo application. The encryption key is hardcoded for demonstration purposes. In a production environment:

- Use a user-provided password for encryption
- Implement proper key derivation (PBKDF2, Argon2, etc.)
- Consider using Web Crypto API for better security
- Never store unencrypted seeds
- Use secure storage mechanisms

## Project Structure

```
wallet-demo/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx             # Home page
│   └── globals.css          # Global styles
├── components/
│   ├── WalletApp.tsx        # Main application component
│   ├── AccountList.tsx      # Account list component
│   ├── WalletDetails.tsx    # Wallet details component
│   └── Modal.tsx            # Modal component
├── lib/
│   └── services/
│       ├── seedVault.ts     # Encrypted seed storage service
│       └── stellarWallet.ts # Stellar network operations
├── next.config.js           # Next.js configuration
└── package.json             # Dependencies
```

## Technologies Used

- **Next.js 14**: React framework with App Router
- **React 18**: UI library
- **TypeScript**: Type safety
- **Stellar SDK**: For Stellar blockchain operations
- **CryptoJS**: For AES encryption

## Network

This demo uses the **Stellar Testnet**. All operations are on the test network and use testnet XLM.

## License

MIT
