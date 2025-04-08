import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ISandbox } from '../../grist-core/_build/app/server/lib/ISandbox';
import {
  initializeGristAPI,
  getOrg,
  cleanupHomeWorkspace,
  createFinancialWorkspaces,
  getOrCreateDocument,
  createIncomeStatementTable,
  createBalanceSheetTable,
  createTransactionDetailsTable,
  INCOME_STATEMENT_DOC_NAME,
  BALANCE_SHEET_DOC_NAME,
  CASH_FLOW_DOC_NAME,
} from '../lib/grist-functions';

// Put here the URL of your document.
const GRIST_URL = "http://localhost:8484/api";


export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const api = initializeGristAPI();
  
  try {
    // Initialize organization
    const org = await getOrg(api);
    
    // Clean up existing home workspace
    await cleanupHomeWorkspace(api, org);
    
    // Create financial workspaces
    const workspaces = await createFinancialWorkspaces(api, org);
    
    // Create Income Statement document and table
    const incomeStatementDoc = await getOrCreateDocument(api, workspaces.incomeStatement, INCOME_STATEMENT_DOC_NAME);
    
    const ISIncomeStatementTable = await createIncomeStatementTable(api, incomeStatementDoc);
    const ISBalanceSheetTable = await createBalanceSheetTable(api, incomeStatementDoc);
    const ISTransactionDetailsTable = await createTransactionDetailsTable(api, incomeStatementDoc);

    // Create Balance Sheet document and table
    const balanceSheetDoc = await getOrCreateDocument(api, workspaces.balanceSheet, BALANCE_SHEET_DOC_NAME);

    const BSIncomeStatementTable = await createIncomeStatementTable(api, balanceSheetDoc);
    const BSBalanceSheetTable = await createBalanceSheetTable(api, balanceSheetDoc);
    const BSTransactionDetailsTable = await createTransactionDetailsTable(api, balanceSheetDoc);

    // Create Cash Flow document and table
    const cashFlowDoc = await getOrCreateDocument(api, workspaces.cashFlow, CASH_FLOW_DOC_NAME);

    const CFIncomeStatementTable = await createIncomeStatementTable(api, cashFlowDoc);
    const CFBalanceSheetTable = await createBalanceSheetTable(api, cashFlowDoc);
    const CFTransactionDetailsTable = await createTransactionDetailsTable(api, cashFlowDoc);
    
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Grist setup completed successfully!',
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
