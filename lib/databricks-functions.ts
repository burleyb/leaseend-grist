import * as fs from 'fs/promises';
import { DBSQLClient } from '@databricks/sql';
import { IRecord } from 'grist-api'; 
import 'dotenv/config'; // Ensure environment variables are loaded

// --- Environment Variable Checks ---
if (!process.env.DATABRICKS_API_KEY_PATH) {
    throw new Error("DATABRICKS_API_KEY_PATH environment variable not set.");
}
if (!process.env.DATABRICKS_SERVER_HOSTNAME) {
    throw new Error("DATABRICKS_SERVER_HOSTNAME environment variable not set.");
}
if (!process.env.DATABRICKS_HTTP_PATH) {
    throw new Error("DATABRICKS_HTTP_PATH environment variable not set.");
}

// --- Constants ---
const DATABRICKS_TABLE = process.env.DATABRICKS_INCOME_STATEMENT_TABLE || "bronze.ns_netsuite.netsuite2__income_statement"; // Allow override
const DATABRICKS_FETCH_BATCH_SIZE = parseInt(process.env.DATABRICKS_FETCH_BATCH_SIZE || "1000", 10);

// Define an interface for the expected record structure (optional but recommended)
// Export the interface so it can be imported elsewhere
export interface IDatabricksIncomeStatementRecord {
    // Match the full Grist schema
    transaction_id: number;
    transaction_line_id: number;
    _fivetran_synced_date: string; // Assuming Date comes as string
    accounting_book_id: number;
    accounting_book_name: string;
    accounting_period_id: number;
    accounting_period_ending: string; // Assuming Date comes as string
    accounting_period_name: string;
    is_accounting_period_adjustment: boolean;
    is_accounting_period_closed: boolean;
    account_name: string;
    account_display_name: string;
    account_type_name: string;
    account_type_id: string;
    account_id: number;
    account_number: string;
    subsidiary_id: number;
    subsidiary_full_name: string;
    subsidiary_name: string;
    subsidiary_currency_symbol: string;
}

// --- Databricks Connection Helpers ---

// Reads the Databricks API token from the specified file path
const getDatabricksToken = async (): Promise<string> => {
    try {
        const token = await fs.readFile(process.env.DATABRICKS_API_KEY_PATH!, 'utf8');
        return token.trim();
    } catch (error) {
        console.error(`Error reading Databricks API key from ${process.env.DATABRICKS_API_KEY_PATH}:`, error);
        throw new Error("Failed to read Databricks API key.");
    }
};

// Initializes the Databricks SQL Client
export const initializeDatabricksClient = async (): Promise<DBSQLClient> => {
    const token = await getDatabricksToken();
    const client = new DBSQLClient();

    try {
        console.log(`[Databricks Client] Attempting to connect with host: ${process.env.DATABRICKS_SERVER_HOSTNAME}`); // Added for debugging
        await client.connect({
            host: process.env.DATABRICKS_SERVER_HOSTNAME!,
            path: process.env.DATABRICKS_HTTP_PATH!,
            token: token,
        });
        console.log("[Databricks Client] Connected successfully.");
        return client;
    } catch (error) {
        console.error("[Databricks Client] Connection failed:", error);
        // Ensure client is closed if connection fails partway?
        // await client.close(); // Might not be necessary or possible depending on state
        throw new Error("Failed to connect to Databricks.");
    }
};

// Fetches all records from the specified Databricks table in batches
export const fetchAllDatabricksIncomeStatements = async (client: DBSQLClient): Promise<IDatabricksIncomeStatementRecord[]> => {
    // Remove explicit types for session and operation, rely on inference
    let session = null;
    let operation = null;
    const allResults: IDatabricksIncomeStatementRecord[] = [];
    let offset = 0;
    console.log(`[Databricks Fetch] Starting fetch from ${DATABRICKS_TABLE} with batch size ${DATABRICKS_FETCH_BATCH_SIZE}`);

    try {
        session = await client.openSession();
        console.log("[Databricks Session] Opened.");
        if (!session) {
            throw new Error("Failed to open Databricks session.");
        }

        // Update query to select all necessary columns - **USE BACKTICKS FOR COLUMN NAMES**
        // Ensure column names here EXACTLY match the Databricks table column names
        const columnsToSelect = `
            \`transaction_id\`, 
            \`transaction_line_id\`, 
            \`_fivetran_synced_date\`,
            \`accounting_book_id\`, 
            \`accounting_book_name\`, 
            \`accounting_period_id\`,
            \`accounting_period_ending\`, 
            \`accounting_period_name\`, 
            \`is_accounting_period_adjustment\`,
            \`is_accounting_period_closed\`, 
            \`account_name\`, 
            \`account_display_name\`,
            \`account_type_name\`, 
            \`account_type_id\`, 
            \`account_id\`, 
            \`account_number\`,
            \`subsidiary_id\`, 
            \`subsidiary_full_name\`, 
            \`subsidiary_name\`, 
            \`subsidiary_currency_symbol\`
        `;

        while (true) {
            // Use transaction_id and transaction_line_id for ordering if they form a composite key
            const query = `SELECT ${columnsToSelect} FROM ${DATABRICKS_TABLE} ORDER BY transaction_id LIMIT ${DATABRICKS_FETCH_BATCH_SIZE} OFFSET ${offset}`;
            console.log(`[Databricks Fetch] Executing batch query: OFFSET ${offset}`);
            operation = await session.executeStatement(query, { runAsync: true });

            // Cast operation to any to access methods if types are problematic
            await (operation as any).waitUntilReady(); 
            const result = await (operation as any).fetchAll() as IDatabricksIncomeStatementRecord[]; 
            await (operation as any).close(); 
            operation = null; 

            if (result && result.length > 0) {
                console.log(`[Databricks Fetch] Fetched ${result.length} records.`);
                allResults.push(...result);
                offset += result.length;
            } else {
                console.log("[Databricks Fetch] No more records found. Fetch complete.");
                break; 
            }

            if (offset >= 100000) { 
                console.warn("[Databricks Fetch] Reached safety limit of 100,000 records fetched. Stopping.");
                break;
            }
        }

        console.log(`[Databricks Fetch] Total records fetched: ${allResults.length}`);
        return allResults;

    } catch (error) {
        console.error("[Databricks Fetch] Error during fetch:", error);
        if (operation && typeof (operation as any).close === 'function') {
            try { await (operation as any).close(); } catch (closeErr) { console.error("Error closing operation after fetch error:", closeErr); }
        }
        throw new Error("Failed to fetch data from Databricks.");
    } finally {
        if (session && typeof (session as any).close === 'function') {
            try { await (session as any).close(); console.log("[Databricks Session] Closed."); } catch (closeErr) { console.error("Error closing session:", closeErr); }
        }
    }
};

// Maps Databricks records to Grist IRecord format 
// Revert to simpler mapping for now, address assignability in calling file
export const mapDatabricksToGrist = (databricksRecords: IDatabricksIncomeStatementRecord[]): IDatabricksIncomeStatementRecord[] => {
    console.log(`[Data Mapping] Mapping ${databricksRecords.length} records for Grist.`);
    return databricksRecords; 
}; 