/**
 * A Jest reporter that prints what the content check says and nothing of
 * Jest's own: the report, and why the run failed when it did.
 */
class ContentReporter {
  onTestResult(_test, result) {
    for (const entry of result.console ?? []) process.stdout.write(`${entry.message}\n`);
    if (result.testExecError) {
      // The course did not even load: a syntax error, a module that throws.
      process.stderr.write(`\n${result.testExecError.stack ?? result.testExecError.message}\n`);
      return;
    }
    for (const test of result.testResults) {
      for (const message of test.failureMessages) {
        process.stderr.write(`\n${message.split('\n')[0]}\n`);
      }
    }
  }
}

module.exports = ContentReporter;
