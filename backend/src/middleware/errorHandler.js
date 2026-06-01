const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (res.headersSent) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
    return;
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
};

export default errorHandler;
