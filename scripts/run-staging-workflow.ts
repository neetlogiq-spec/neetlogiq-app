import StagingWorkflowManager from '../src/lib/data/staging-workflow-manager';
import chalk from 'chalk';
import inquirer from 'inquirer';

async function main() {
  console.log(chalk.blue.bold('🚀 Complete Staging Workflow Manager'));
  console.log(chalk.blue('=====================================\n'));

  try {
    // Use AIQ PG 2023 data path
    const aiqDataPath = '/Users/kashyapanand/Desktop/EXPORT/AIQ_PG_2023/';
    console.log(chalk.blue(`📁 Using AIQ data path: ${aiqDataPath}`));

    // Initialize workflow manager
    const workflowManager = new StagingWorkflowManager();
    
    // Run complete workflow
    await workflowManager.runCompleteWorkflow(aiqDataPath);
    
    console.log(chalk.green.bold('\n🎉 Complete staging workflow finished successfully!'));
    console.log(chalk.blue('\n📋 Summary:'));
    console.log(chalk.white('✅ Data imported and validated'));
    console.log(chalk.white('✅ Ranks processed'));
    console.log(chalk.white('✅ Colleges and courses mapped'));
    console.log(chalk.white('✅ Data imported to unified database'));
    console.log(chalk.white('✅ Staging database cleared'));
    
    console.log(chalk.cyan('\n🎯 Ready for next counselling dataset import!'));

  } catch (error: any) {
    console.error(chalk.red.bold('\n❌ Staging workflow failed:'));
    console.error(chalk.red(error.message));
    
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red.bold('❌ An unexpected error occurred:'));
  console.error(chalk.red(error.message));
  process.exit(1);
});
