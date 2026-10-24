-- Members sign in with phone and code alone, so look them up by phone across gyms.
CREATE INDEX members_phone ON members(phone);
