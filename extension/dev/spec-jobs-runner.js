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

test('computeJobTransition marks capture success as captured', () => {
  const result = computeJobTransition({
    type: 'capture_succeeded',
    markdown: '# Hello',
  });

  assertDeepEqual(result, {
    processingState: 'captured',
    retryable: false,
    markdown: '# Hello',
  });
});
