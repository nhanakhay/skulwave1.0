const packages = [
  [1, 'Research Daily', '350 kbps', 1, '300 MB', 322122547, 1], [2, 'Research Weekly', '350 kbps', 7, '2.5 GB', 2684354560, 7], [3, 'Research Monthly', '350 kbps', 30, '15 GB', 16106127360, 29], [4, 'Basic Daily', '1 Mbps', 1, '1 GB', 1073741824, 2], [5, 'Basic Weekly', '1 Mbps', 7, '8 GB', 8589934592, 12], [6, 'Basic Monthly', '1 Mbps', 30, 'Unlimited', 0, 49], [7, 'Premium Daily', '4 Mbps', 1, '5 GB', 5368709120, 5], [8, 'Premium Weekly', '4 Mbps', 7, '20 GB', 21474836480, 25], [9, 'Premium Monthly', '4 Mbps', 30, 'Unlimited', 0, 79], [10, 'VIP Daily', '8 Mbps', 1, '20 GB', 21474836480, 10], [11, 'VIP Weekly', '8 Mbps', 7, 'Unlimited', 0, 40], [12, 'VIP Monthly', '8 Mbps', 30, 'Unlimited', 0, 120],
];

module.exports = {
  id: '005_seed_default_packages',
  description: 'Insert missing default packages without altering existing package records',
  up: async ({ run }) => {
    for (const item of packages) await run('INSERT OR IGNORE INTO packages (id,name,speed,duration_days,data_cap,data_cap_bytes,price) VALUES (?,?,?,?,?,?,?)', item);
  },
};
