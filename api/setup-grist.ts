import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  initializeGristAPI,
  getOrg,
  cleanupHomeWorkspace,
  createFinancialWorkspaces,
  getOrCreateDocument,
  createIncomeStatementTable,
  addSampleIncomeData,
  INCOME_STATEMENT_DOC_NAME
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
    await api.setDocId(incomeStatementDoc.id);
    
    const incomeStatementTable = await createIncomeStatementTable(api, incomeStatementDoc);
    await addSampleIncomeData(api, "Income_Statement", incomeStatementDoc);
    
    // Create Balance Sheet document
    const balanceSheetDoc = await api.createDoc({
      workspaceId: workspaces.balanceSheet.id,
      name: 'Balance Sheet'
    });
    console.log("[Created doc]", balanceSheetDoc);
    
    // Create Cash Flow document
    const cashFlowDoc = await api.createDoc({
      workspaceId: workspaces.cashFlow.id,
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
