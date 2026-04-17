test('computeJobTransition rolls assigning back to analyzed checkpoint', () => {
  const result = computeJobTransition({
    type: 'rollback_stuck_job',
    processingState: 'assigning',
  });

  assertDeepEqual(result, {
    processingState: 'analyzed',
    retryable: true,
  });
});
