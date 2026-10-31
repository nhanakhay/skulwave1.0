module.exports = {
  id: '008_replace_research_monthly_with_3basic',
  description: 'Replace the Research Monthly package with the 3Basic three-day package',
  up: async ({ run }) => {
    await run(
      "UPDATE packages SET name=?, speed=?, duration_days=?, data_cap=?, data_cap_bytes=?, price=? WHERE id=?",
      ['3Basic', '1 Mbps', 3, '10 GB', 10737418240, 5, 3],
    );
  },
};
