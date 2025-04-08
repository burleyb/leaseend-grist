import 'dotenv/config'; // Load environment variables
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GristDocAPI, IOrg, IDoc, ITable, IRecord, CellValue } from 'grist-api'; // Import Grist types including CellValue
import { DBSQLClient } from '@databricks/sql'; // Import Databricks type

// Import Grist functions (Assuming they export necessary types or use base types)
import { 
  initializeGristAPI,
  getOrg,
  createFinancialWorkspaces, // Returns Promise<IFinancialWorkspaces> - Need IFinancialWorkspaces type below
  getOrCreateDocument,
  // Assuming these constants are correctly exported from the .ts file
  LEASE_END_ORG_NAME, 
  INCOME_STATEMENT_WORKSPACE_NAME,
  BALANCE_SHEET_WORKSPACE_NAME, 
  CASH_FLOW_WORKSPACE_NAME,     
  HOME_WORKSPACE_NAME,          
  INCOME_STATEMENT_DOC_NAME,
  BALANCE_SHEET_DOC_NAME,       
  CASH_FLOW_DOC_NAME,
  INCOME_STATEMENT_TABLE_NAME            
} from '../lib/grist-functions'; // Use .js extension if compiled output is targeted

// Import Databricks functions (Assuming they export necessary types)
import { 
  initializeDatabricksClient,
  fetchAllDatabricksIncomeStatements, // Returns Promise<IDatabricksIncomeStatementRecord[]>
  mapDatabricksToGrist, // Currently identity, takes and returns IDatabricksIncomeStatementRecord[]
  // Import the shared interface
  IDatabricksIncomeStatementRecord 
} from '../lib/databricks-functions'; // Use .js extension if compiled output is targeted

// --- Local Types (if not imported) ---
// Remove local definitions, use imported IDatabricksIncomeStatementRecord
/*
interface IFinancialWorkspaces { ... }
interface IDatabricksIncomeStatementRecord { ... }
*/
// Define IFinancialWorkspaces if not exported/imported from grist-functions
interface IFinancialWorkspaces {
  incomeStatement: { id: number; name: string; };
  balanceSheet: { id: number; name: string; };
  cashFlow: { id: number; name: string; };
}

// --- Constants ---

// --- Grist Table Helper (Local) ---
// Add types for api and docId, return type Promise<number | string> (table ID)
const ensureIncomeStatementTableForSync = async (api: GristDocAPI, docId: string): Promise<string | number> => {
  const tableName = INCOME_STATEMENT_TABLE_NAME;
  console.log(`[Grist API - Local] Looking for table: ${tableName} in doc ${docId}`);
  let tableMeta: ITable | undefined | null = await api.getTableByName({ name: tableName, docId }); 

  if (!tableMeta) {
    console.log(`[Grist API - Local] Table '${tableName}' not found, creating...`);
    // Use the CORRECT schema based on grist-functions.ts
    const schema = {
      tables: [{
        id: tableName,
        columns: [
            { "id": "transaction_id", "fields": { "label": "Transaction ID", "type": "Int" } },
            { "id": "transaction_line_id", "fields": { "label": "Transaction Line ID", "type": "Int" } },
            { "id": "_fivetran_synced_date", "fields": { "label": "Fivetran Synced Date", "type": "Date" } },
            { "id": "accounting_book_id", "fields": { "label": "Accounting Book ID", "type": "Int" } },
            { "id": "accounting_book_name", "fields": { "label": "Accounting Book Name", "type": "Text" } },
            { "id": "accounting_period_id", "fields": { "label": "Accounting Period ID", "type": "Int" } },
            { "id": "accounting_period_ending", "fields": { "label": "Accounting Period Ending", "type": "Date" } },
            { "id": "accounting_period_name", "fields": { "label": "Accounting Period Name", "type": "Text" } },
            { "id": "is_accounting_period_adjustment", "fields": { "label": "Is Accounting Period Adjustment", "type": "Bool" } },
            { "id": "is_accounting_period_closed", "fields": { "label": "Is Accounting Period Closed", "type": "Bool" } },
            { "id": "account_name", "fields": { "label": "Account Name", "type": "Text" } },
            { "id": "account_display_name", "fields": { "label": "Account Display Name", "type": "Text" } },
            { "id": "account_type_name", "fields": { "label": "Account Type Name", "type": "Text" } },
            { "id": "account_type_id", "fields": { "label": "Account Type ID", "type": "Text" } },
            { "id": "account_id", "fields": { "label": "Account ID", "type": "Int" } },
            { "id": "account_number", "fields": { "label": "Account Number", "type": "Text" } },
            { "id": "subsidiary_id", "fields": { "label": "Subsidiary ID", "type": "Int" } },
            { "id": "subsidiary_full_name", "fields": { "label": "Subsidiary Full Name", "type": "Text" } },
            { "id": "subsidiary_name", "fields": { "label": "Subsidiary Name", "type": "Text" } },
            { "id": "subsidiary_currency_symbol", "fields": { "label": "Subsidiary Currency Symbol", "type": "Text" } }
        ]
      }]
    };
    try {
        await api.createTable({ docId, schema });
        console.log(`[Grist API - Local] Submitted creation request for table '${tableName}'.`);
        tableMeta = await api.getTableByName({ name: tableName, docId });
        if (!tableMeta) {
             await new Promise(resolve => setTimeout(resolve, 1000)); 
             tableMeta = await api.getTableByName({ name: tableName, docId });
        }
        if (!tableMeta) throw new Error(`Failed to confirm table creation for '${tableName}'.`);
         console.log(`[Grist API - Local] Confirmed creation of table '${tableName}':`, tableMeta.id);
    } catch (error) {
        console.error(`[Grist API - Local] Failed to create table '${tableName}':`, error);
        throw error; 
    }
  } else {
     console.log(`[Grist API - Local] Found table '${tableName}':`, tableMeta.id);
     // TODO: Add schema validation/migration if found table doesn't match expected schema
  }
  return tableMeta.id; 
};

// --- Main Handler --- 
// Add types for event and return type
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Type the client explicitly
  let databricksClient: DBSQLClient | undefined;
  const api: GristDocAPI = initializeGristAPI(); 

  try {
    console.log("[Handler] Starting execution...");

    // 1. Initialize Databricks Client (Imported)
    console.log("[Handler] Initializing Databricks client...");
    databricksClient = await initializeDatabricksClient();

    // 2. Initialize Grist Org & Workspaces (Imported)
    console.log("[Handler] Initializing Grist setup...");
    const org: IOrg = await getOrg(api);
    // Optional: await cleanupHomeWorkspace(api, org);
    const workspaces: IFinancialWorkspaces = await createFinancialWorkspaces(api, org);
    
    // 3. Get/Create Grist Document & Table
    console.log("[Handler] Ensuring Grist document and table exist...");
    // getOrCreateDocument returns Promise<IDoc>
    const incomeStatementDoc: IDoc = await getOrCreateDocument(api, workspaces.incomeStatement, INCOME_STATEMENT_DOC_NAME);
    const incomeStatementDocId: string = incomeStatementDoc.id;
    await api.setDocId(incomeStatementDocId); 
    
    // Use LOCAL ensureIncomeStatementTableForSync
    const incomeStatementTableId = await ensureIncomeStatementTableForSync(api, incomeStatementDocId);
    console.log(`[Handler] Using Grist Doc ID: ${incomeStatementDocId}, Table ID: ${incomeStatementTableId}`);

    // 4. Fetch Data from Databricks (Imported)
    console.log("[Handler] Fetching data from Databricks...");
    // Use the imported interface type
    const databricksData: IDatabricksIncomeStatementRecord[] = await fetchAllDatabricksIncomeStatements(databricksClient!);

    // 5. Map Data for Grist (Imported)
    const mappedData: IDatabricksIncomeStatementRecord[] = mapDatabricksToGrist(databricksData);
    // Explicitly map to IRecord[] to satisfy syncTable requirements
    const gristRecords: IRecord[] = mappedData.map((record: IDatabricksIncomeStatementRecord): IRecord => {
        // Create a new object that conforms to IRecord structure
        // Include all columns from the correct schema
        const newRecord: IRecord = {
            transaction_id: record.transaction_id,
            transaction_line_id: record.transaction_line_id,
            _fivetran_synced_date: record._fivetran_synced_date,
            accounting_book_id: record.accounting_book_id,
            accounting_book_name: record.accounting_book_name,
            accounting_period_id: record.accounting_period_id,
            accounting_period_ending: record.accounting_period_ending,
            accounting_period_name: record.accounting_period_name,
            is_accounting_period_adjustment: record.is_accounting_period_adjustment,
            is_accounting_period_closed: record.is_accounting_period_closed,
            account_name: record.account_name,
            account_display_name: record.account_display_name,
            account_type_name: record.account_type_name,
            account_type_id: record.account_type_id,
            account_id: record.account_id,
            account_number: record.account_number,
            subsidiary_id: record.subsidiary_id,
            subsidiary_full_name: record.subsidiary_full_name,
            subsidiary_name: record.subsidiary_name,
            subsidiary_currency_symbol: record.subsidiary_currency_symbol
        };
        return newRecord;
    });

    // 6. Sync Data with Grist Table
    if (gristRecords.length > 0) {
        console.log(`[Handler] Starting Grist syncTable for ${gristRecords.length} records...`);
        const syncResult = await api.syncTable({
            tableName: INCOME_STATEMENT_TABLE_NAME, 
            records: gristRecords,
            keyColIds: ['transaction_id', 'transaction_line_id'], // Assuming composite key
            docId: incomeStatementDocId 
        });
        console.log("[Handler] Grist syncTable completed:", syncResult);

        // Optional: Create other docs (using imported functions)
        // console.log("[Handler] Creating/Getting other financial documents...");
        // await getOrCreateDocument(api, workspaces.balanceSheet, BALANCE_SHEET_DOC_NAME);
        // await getOrCreateDocument(api, workspaces.cashFlow, CASH_FLOW_DOC_NAME);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Databricks to Grist sync completed successfully!',
                syncResult: syncResult,
                recordsProcessed: gristRecords.length,
            }, null, 2),
        };
    } else {
         console.log("[Handler] No records fetched from Databricks. Nothing to sync.");
         return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'No records found in Databricks table to sync.',
                syncResult: { numAdded: 0, numUpdated: 0 },
                recordsProcessed: 0,
            }, null, 2),
         };
    }

  } catch (error: any) { // Catch error as any type
    console.error("[Handler] Error during execution:", error);
    // Ensure databricksClient is closed in case of error after initialization
    if (databricksClient && typeof databricksClient.close === 'function') {
        try {
            await databricksClient.close();
            console.log("[Databricks Client] Disconnected after error.");
        } catch (closeError) {
            console.error("[Databricks Client] Error closing connection after handler error:", closeError);
        }
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error during Databricks to Grist sync process.',
        // Access error message safely
        error: error instanceof Error ? error.message : String(error), 
      }),
    };
  } finally {
    // Close client if it was initialized and the handler didn't error out before this block
    // Note: The catch block above now handles closing on error.
    if (databricksClient && typeof databricksClient.close === 'function') {
      try {
          // Check if already closed in catch block? Might be redundant.
          // Consider moving all close logic to finally if desired.
        await databricksClient.close();
        console.log("[Databricks Client] Disconnected cleanly.");
      } catch (closeError) {
        console.error("[Databricks Client] Error closing connection in finally:", closeError);
      }
    }
    console.log("[Handler] Execution finished.");
  }
}; 