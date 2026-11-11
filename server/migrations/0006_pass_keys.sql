-- Each member gets a random key that signs their check-in QR, so a pass can't be worked out from a
-- member ID. The change log moves forward so phones already synced pick the key up.
UPDATE gym_seq SET seq = seq + 1;
UPDATE docs
SET data = json_set(data, '$.passKey', lower(hex(randomblob(32)))),
    seq = (SELECT seq FROM gym_seq WHERE gym_seq.gym_id = docs.gym_id)
WHERE kind = 'members' AND deleted = 0 AND json_extract(data, '$.passKey') IS NULL;
