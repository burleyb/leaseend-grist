# LeaseEnd Grist

A financial reporting system built with Grist, providing automated generation of Income Statements, Balance Sheets, and Cash Flow Statements.

## Features

- Automated financial report generation
- Multi-workspace organization for different financial statements
- Structured data tables for financial metrics
- Serverless API integration
- Real-time data synchronization

## Prerequisites

- Node.js and npm
- Grist instance (self-hosted or cloud)
- AWS account (for serverless deployment)
- Grist API key

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd leaseend-grist
```

2. Install dependencies:
```bash
npm install
```

3. Set up your Grist API key:
   - Create a `.grist-api-key` file in the root directory
   - Add your API key to the file
   - Or set the `GRIST_API_KEY` environment variable

4. Configure your Grist server URL in `serverless.yml`

## Usage

### Setting Up Financial Workspaces

The system automatically creates three main workspaces:
- Income Statement
- Balance Sheet
- Cash Flow

Example from `api/setup-grist.js`:

```javascript
const { GristDocAPI } = require('grist-api');

const api = new GristDocAPI({ server: GRIST_URL });

// Create organization structure
const org = await api.getOrgByName({ name: 'Lease End - Finance' });
await api.setOrgId(org.id);

// Create Income Statement workspace
let incomeStatementWorkspace = await api.createWorkspace({ 
  orgId: org.id, 
  name: 'Income Statement'
});
```

### Creating Financial Documents

Each workspace contains its corresponding financial document. Example:

```javascript
const incomeStatementDoc = await api.createDoc({
  workspaceId: incomeStatementWorkspaceId, 
  name: 'Income Statement'
});

await api.setDocId(incomeStatementDoc);
```

### Defining Table Schemas

Example of creating an Income Statement table:

```javascript
await api.createTable({
  docId: incomeStatementDocId,
  tables: [{
    id: "Income_Statement",
    columns: [
      { id: "date", fields: { label: "Date" } },
      { id: "revenue", fields: { label: "Revenue" } },
      { id: "costOfGoodsSold", fields: { label: "Cost of Goods Sold" } },
      { id: "grossProfit", fields: { label: "Gross Profit" } },
      { id: "operatingExpenses", fields: { label: "Operating Expenses" } },
      { id: "netIncome", fields: { label: "Net Income" } }
    ]
  }]
});
```

### Adding Financial Data

Example of adding income statement records:

```javascript
await api.addRecords({
  tableName: "Income_Statement",
  records: [
    {
      date: '2024-01-01',
      revenue: 1000,
      costOfGoodsSold: 500,
      grossProfit: 500,
      operatingExpenses: 200,
      netIncome: 300
    },
    // Additional records...
  ]
});
```

### Syncing Data

Example of synchronizing data with existing records:

```javascript
await api.syncTable({
  tableId: incomeStatementTableId,
  records: [{
    date: '2024-01-01',
    revenue: 1000,
    costOfGoodsSold: 500,
    grossProfit: 500,
    operatingExpenses: 200,
    netIncome: 300
  }],
  keyColIds: ['date']
});
```

## API Endpoints

The system provides several serverless endpoints:

- `POST /setup-grist`: Initializes the Grist workspace structure
- `POST /create-income-statement`: Generates an income statement
- `POST /create-balance-sheet`: Generates a balance sheet
- `POST /create-cash-flow-statement`: Generates a cash flow statement

## Deployment

Deploy to AWS using Serverless Framework:

```bash
serverless deploy
```

Configuration can be customized in `serverless.yml`.

## Development

### Project Structure

```
leaseend-grist/
├── api/
│   ├── create-balance-sheet.js
│   ├── create-cash-flow-statement.js
│   ├── create-income-statement.js
│   └── setup-grist.js
├── lib/
│   └── grist-api/
├── index.js
├── serverless.yml
└── package.json
```

### Local Development

1. Start a local Grist instance
2. Update `GRIST_URL` in your code to point to your local instance
3. Run functions locally:
```bash
serverless invoke local -f setup-grist
```

## Error Handling

The API includes comprehensive error handling:

```javascript
try {
  // API operations
} catch (error) {
  console.error(error);
  return {
    statusCode: 500,
    body: JSON.stringify({
      message: 'Error',
      error: error,
    }),
  };
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License

## Support

For support, please open an issue in the GitHub repository.