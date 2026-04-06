use anchor_lang::prelude::*;

#[error_code]
pub enum Error {
    InvalidFee,
    InvalidMinimumCampaignDuration,
    NoRewards,
    TooManyRewards,
    InvalidHash,
    InvalidStartTime,
    InvalidDuration,
    RewardAmountTooLow,
    NoClaimableFee,
    Forbidden,
    NoRewardAmount,
    NoRoot,
    NonExistentReward,
    InvalidProof,
    InconsistentClaimedRewardAmount,
    InvalidCampaignType,
    InvalidRebate,
    InvalidMaximumCampaignDuration,
    NoPoints,
}
