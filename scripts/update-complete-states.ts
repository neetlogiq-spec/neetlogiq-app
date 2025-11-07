import * as parquet from 'parquetjs';
import path from 'path';

async function main() {
  console.log('🏛️ Updating Complete States List');
  console.log('===============================');

  try {

    // Complete list of Indian states and union territories
    const completeStates = [
      { id: 1, name: 'Andaman and Nicobar Islands', code: 'AN', status: 'active', created_at: new Date().toISOString() },
      { id: 2, name: 'Andhra Pradesh', code: 'AP', status: 'active', created_at: new Date().toISOString() },
      { id: 3, name: 'Arunachal Pradesh', code: 'AR', status: 'active', created_at: new Date().toISOString() },
      { id: 4, name: 'Assam', code: 'AS', status: 'active', created_at: new Date().toISOString() },
      { id: 5, name: 'Bihar', code: 'BR', status: 'active', created_at: new Date().toISOString() },
      { id: 6, name: 'Chandigarh', code: 'CH', status: 'active', created_at: new Date().toISOString() },
      { id: 7, name: 'Chhattisgarh', code: 'CG', status: 'active', created_at: new Date().toISOString() },
      { id: 8, name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN', status: 'active', created_at: new Date().toISOString() },
      { id: 9, name: 'Delhi', code: 'DL', status: 'active', created_at: new Date().toISOString() },
      { id: 10, name: 'Goa', code: 'GA', status: 'active', created_at: new Date().toISOString() },
      { id: 11, name: 'Gujarat', code: 'GJ', status: 'active', created_at: new Date().toISOString() },
      { id: 12, name: 'Haryana', code: 'HR', status: 'active', created_at: new Date().toISOString() },
      { id: 13, name: 'Himachal Pradesh', code: 'HP', status: 'active', created_at: new Date().toISOString() },
      { id: 14, name: 'Jammu and Kashmir', code: 'JK', status: 'active', created_at: new Date().toISOString() },
      { id: 15, name: 'Jharkhand', code: 'JH', status: 'active', created_at: new Date().toISOString() },
      { id: 16, name: 'Karnataka', code: 'KA', status: 'active', created_at: new Date().toISOString() },
      { id: 17, name: 'Kerala', code: 'KL', status: 'active', created_at: new Date().toISOString() },
      { id: 18, name: 'Ladakh', code: 'LA', status: 'active', created_at: new Date().toISOString() },
      { id: 19, name: 'Madhya Pradesh', code: 'MP', status: 'active', created_at: new Date().toISOString() },
      { id: 20, name: 'Maharashtra', code: 'MH', status: 'active', created_at: new Date().toISOString() },
      { id: 21, name: 'Manipur', code: 'MN', status: 'active', created_at: new Date().toISOString() },
      { id: 22, name: 'Meghalaya', code: 'ML', status: 'active', created_at: new Date().toISOString() },
      { id: 23, name: 'Mizoram', code: 'MZ', status: 'active', created_at: new Date().toISOString() },
      { id: 24, name: 'Nagaland', code: 'NL', status: 'active', created_at: new Date().toISOString() },
      { id: 25, name: 'Odisha', code: 'OR', status: 'active', created_at: new Date().toISOString() },
      { id: 26, name: 'Puducherry', code: 'PY', status: 'active', created_at: new Date().toISOString() },
      { id: 27, name: 'Punjab', code: 'PB', status: 'active', created_at: new Date().toISOString() },
      { id: 28, name: 'Rajasthan', code: 'RJ', status: 'active', created_at: new Date().toISOString() },
      { id: 29, name: 'Sikkim', code: 'SK', status: 'active', created_at: new Date().toISOString() },
      { id: 30, name: 'Tamil Nadu', code: 'TN', status: 'active', created_at: new Date().toISOString() },
      { id: 31, name: 'Telangana', code: 'TG', status: 'active', created_at: new Date().toISOString() },
      { id: 32, name: 'Tripura', code: 'TR', status: 'active', created_at: new Date().toISOString() },
      { id: 33, name: 'Uttar Pradesh', code: 'UP', status: 'active', created_at: new Date().toISOString() },
      { id: 34, name: 'Uttarakhand', code: 'UK', status: 'active', created_at: new Date().toISOString() },
      { id: 35, name: 'West Bengal', code: 'WB', status: 'active', created_at: new Date().toISOString() }
    ];

    console.log(`📊 Creating states.parquet with ${completeStates.length} states and union territories...`);

    // Create new states Parquet file with complete data
    const statesPath = path.join(process.cwd(), 'data', 'parquet', 'states.parquet');
    
    // Define schema
    const schema = new parquet.ParquetSchema({
      id: { type: 'INT64' },
      name: { type: 'UTF8' },
      code: { type: 'UTF8', optional: true },
      status: { type: 'UTF8' },
      created_at: { type: 'UTF8' }
    });

    // Create writer and write data
    const writer = await parquet.ParquetWriter.openFile(schema, statesPath);
    
    for (const state of completeStates) {
      await writer.appendRow(state);
    }
    
    await writer.close();
    
    console.log(`✅ Successfully created states.parquet with ${completeStates.length} states and union territories`);
    console.log('\n📋 Complete list:');
    completeStates.forEach((state, index) => {
      console.log(`${index + 1}. ${state.name} (${state.code})`);
    });

  } catch (error: any) {
    console.error('❌ Update failed:', error);
  }
}

main();
