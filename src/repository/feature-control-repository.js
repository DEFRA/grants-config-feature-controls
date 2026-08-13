const FEATURE_CONTROL_COLLECTION_NAME = 'feature-controls'

export const findFeatureControlByName = async (db, name) => {
  return db.collection(FEATURE_CONTROL_COLLECTION_NAME).findOne({ name })
}

export const upsertFeatureControl = async (db, featureControl) => {
  return db
    .collection(FEATURE_CONTROL_COLLECTION_NAME)
    .updateOne(
      { name: featureControl.name },
      { $set: featureControl },
      { upsert: true }
    )
}

export const findNewlyExpiredFeatureControls = async (db) => {
  return db
    .collection(FEATURE_CONTROL_COLLECTION_NAME)
    .find({
      notifiedExpired: { $ne: true },
      expiryDate: { $lt: new Date() }
    })
    .toArray()
}

export const setFeatureControlToExpired = async (db, featureControl) => {
  return db
    .collection(FEATURE_CONTROL_COLLECTION_NAME)
    .updateOne(
      { name: featureControl.name },
      { $set: { notifiedExpired: true } }
    )
}
