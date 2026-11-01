import axios from 'axios';
import { config } from '../config/index.js';

interface CustomProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  description: string;
  options?: Array<{ label: string; value: string }>;
}

const REQUIRED_PROPERTIES: CustomProperty[] = [
  {
    name: 'zoho_sales_order_id',
    label: 'Zoho Sales Order ID',
    type: 'string',
    fieldType: 'text',
    groupName: 'dealinformation',
    description: 'Reference ID of the Sales Order created in Zoho Books',
  },
  {
    name: 'zoho_sales_order_total',
    label: 'Zoho Sales Order Total',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
    description: 'Total value of the Sales Order including VAT (AED)',
  },
  {
    name: 'zoho_total_invoiced',
    label: 'Zoho Total Invoiced',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
    description: 'Total amount invoiced across milestone invoices (AED)',
  },
  {
    name: 'zoho_percentage_invoiced',
    label: 'Zoho Invoiced %',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
    description: 'Percentage of Sales Order invoiced to date',
  },
  {
    name: 'zoho_total_collected',
    label: 'Zoho Total Collected',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
    description: 'Total payments received and allocated to this deal (AED)',
  },
  {
    name: 'zoho_percentage_collected',
    label: 'Zoho Collected %',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
    description: 'Percentage of Sales Order collected to date',
  },
  {
    name: 'zoho_amount_unpaid',
    label: 'Zoho Amount Invoiced but Unpaid',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
    description: 'Outstanding invoice balance awaiting payment (AED)',
  },
  {
    name: 'zoho_amount_not_invoiced',
    label: 'Zoho Amount Not Yet Invoiced',
    type: 'number',
    fieldType: 'number',
    groupName: 'dealinformation',
    description: 'Remaining unbilled balance on the Sales Order (AED)',
  },
  {
    name: 'zoho_next_due_date',
    label: 'Zoho Next Due Date',
    type: 'date',
    fieldType: 'date',
    groupName: 'dealinformation',
    description: 'Earliest due date among outstanding milestone invoices',
  },
  {
    name: 'zoho_is_overdue',
    label: 'Zoho Has Overdue Invoices',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'dealinformation',
    description: 'Indicates if any unpaid invoice has passed its due date',
    options: [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ],
  },
  {
    name: 'zoho_integration_status',
    label: 'Zoho Integration Status',
    type: 'enumeration',
    fieldType: 'select',
    groupName: 'dealinformation',
    description: 'Status of synchronization with Zoho Books',
    options: [
      { label: 'Synced', value: 'synced' },
      { label: 'Pending', value: 'pending' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Needs Review', value: 'needs_review' },
      { label: 'Error', value: 'error' },
    ],
  },
];

async function setupProperties() {
  console.log('🔄 Checking and creating custom Deal properties in HubSpot CRM...\n');

  const headers = {
    Authorization: `Bearer ${config.hubspot.accessToken}`,
    'Content-Type': 'application/json',
  };

  for (const prop of REQUIRED_PROPERTIES) {
    try {
      // Check if property already exists
      await axios.get(`https://api.hubapi.com/crm/v3/properties/deals/${prop.name}`, { headers });
      console.log(`✓ Property already exists: ${prop.name} (${prop.label})`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Create property
        try {
          await axios.post('https://api.hubapi.com/crm/v3/properties/deals', prop, { headers });
          console.log(`+ Created custom property: ${prop.name} (${prop.label})`);
        } catch (createErr: any) {
          console.error(`❌ Failed to create ${prop.name}:`, createErr.response?.data?.message || createErr.message);
        }
      } else {
        console.error(`❌ Error checking ${prop.name}:`, err.response?.data?.message || err.message);
      }
    }
  }

  console.log('\n✅ All HubSpot custom Deal properties are verified and ready!');
}

setupProperties();

