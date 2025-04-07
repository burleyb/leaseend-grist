const {GristDocAPI} = require('grist-api');

// Put here the URL of your document.
const GRIST_URL = "http://localhost:8484/api";

const LeaseEndOrgName = "Lease End - Finance";
const IncomeStatementWorkspaceName = "Income Statement";
const BalanceSheetWorkspaceName = "Balance Sheet";
const CashFlowWorkspaceName = "Cash Flow";
const HomeWorkspaceName = "Home";
const IncomeStatementDocName = "Income Statement";

// Initialize the Grist API client
const initializeGristAPI = () => {
  return new GristDocAPI({ server: GRIST_URL });
};

// Get or create the LeaseEnd organization
const getOrCreateOrg = async (api) => {
  const org = await api.getOrgByName({ name: LeaseEndOrgName });
  console.log("[Found org]", org);
  await api.setOrgId(org.id);
  return org;
};

// Clean up existing home workspace if it exists
const cleanupHomeWorkspace = async (api, orgId) => {
  const homeWorkspace = await api.getWorkspaceByName({ name: HomeWorkspaceName, orgId });
  console.log("[Found workspace]", homeWorkspace);
  if(homeWorkspace) {
    await api.deleteWorkspace({ workspaceId: homeWorkspace.id });
    console.log("[Deleted workspace]", homeWorkspace);
  }
};

// Get or create a workspace
const getOrCreateWorkspace = async (api, orgId, workspaceName) => {
  let workspace = await api.getWorkspaceByName({ name: workspaceName, orgId });
  console.log(`[Found ${workspaceName} workspace]`, workspace);
  
  if(!workspace) {
    workspace = await api.createWorkspace({ orgId, name: workspaceName });
    console.log(`[Created ${workspaceName} workspace]`, workspace);
  }
  
  return workspace?.id || workspace;
};

// Create workspaces for financial statements
const createFinancialWorkspaces = async (api, orgId) => {
  const workspaces = {
    incomeStatement: await getOrCreateWorkspace(api, orgId, IncomeStatementWorkspaceName),
    balanceSheet: await getOrCreateWorkspace(api, orgId, BalanceSheetWorkspaceName),
    cashFlow: await getOrCreateWorkspace(api, orgId, CashFlowWorkspaceName)
  };
  
  return workspaces;
};

// Create or get a document in a workspace
const getOrCreateDocument = async (api, workspaceId, docName) => {
  let doc = await api.getDocByName({ name: docName, workspaceId });
  console.log(`[Found ${docName} doc]`, doc);
  
  if(!doc) {
    doc = await api.createDoc({ workspaceId, name: docName });
    console.log(`[Created ${docName} doc]`, doc);
  }
  
  return doc?.id || doc;
};

// Create the income statement table schema
const createIncomeStatementTable = async (api, docId) => {
  let table = await api.getTableByName({ name: 'Income_Statement', docId });
  console.log("[Found incomeStatementTable]", table);
  
  if(!table) {
    table = await api.createTable({
      docId,
      schema: {
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
      }
    });
    console.log("[Created table]", table);
  }
  
  return table?.id || table;
};

// Add sample data to the income statement
const addSampleIncomeData = async (api, tableName) => {
  await api.addRecords({
    tableName,
    records: [
      {
        date: '2024-01-01',
        revenue: 1000,
        costOfGoodsSold: 500,
        grossProfit: 500,
        operatingExpenses: 200,
        netIncome: 300
      },
      {
        date: '2024-01-02',
        revenue: 1000,
        costOfGoodsSold: 500,
        grossProfit: 500,
        operatingExpenses: 200,
        netIncome: 300
      }
    ]
  });
};

module.exports.handler = async (event) => {
  const api = initializeGristAPI();
  
  try {
    // Initialize organization
    const org = await getOrCreateOrg(api);
    
    // Clean up existing home workspace
    await cleanupHomeWorkspace(api, org.id);
    
    // Create financial workspaces
    const workspaces = await createFinancialWorkspaces(api, org.id);
    
    // Create Income Statement document and table
    const incomeStatementDoc = await getOrCreateDocument(api, workspaces.incomeStatement, IncomeStatementDocName);
    await api.setDocId(incomeStatementDoc);
    
    const incomeStatementTable = await createIncomeStatementTable(api, incomeStatementDoc);
    await addSampleIncomeData(api, "Income_Statement");
    
    // Create Balance Sheet document
    const balanceSheetDoc = await api.createDoc({
      workspaceId: workspaces.balanceSheet,
      name: 'Balance Sheet'
    });
    console.log("[Created doc]", balanceSheetDoc);
    
    // Create Cash Flow document
    const cashFlowDoc = await api.createDoc({
      workspaceId: workspaces.cashFlow,
      name: 'Cash Flow'
    });
    console.log("[Created doc]", cashFlowDoc);

    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Go Serverless v3.0! Your function executed successfully!',
          input: event,
        },
        null,
        2
      ),
    };
  } catch (error) {
    console.error(error, api);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error',
        error: error,
      }),
    };
  }
};
