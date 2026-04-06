use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    errors::Error,
    state::{ClaimableFee, State},
};

#[event]
struct ClaimFeeEvent {
    mint: Pubkey,
    amount: u64,
    receiver: Pubkey,
}

pub fn handle_claim_fee(ctx: Context<ClaimFee>) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.owner,
        Error::Forbidden
    );

    let claimable_amount = ctx.accounts.claimable_fee.claimable;

    let signer_seeds: &[&[&[u8]]] = &[&[b"state", &[ctx.bumps.state]]];

    let cpi_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            from: ctx.accounts.treasury_token_account.to_account_info(),
            to: ctx.accounts.receiver_token_account.to_account_info(),
            authority: ctx.accounts.state.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        },
    )
    .with_signer(signer_seeds);
    token_interface::transfer_checked(cpi_context, claimable_amount, ctx.accounts.mint.decimals)?;

    ctx.accounts.claimable_fee.claimable = 0;

    emit!(ClaimFeeEvent {
        mint: ctx.accounts.mint.key(),
        amount: claimable_amount,
        receiver: ctx.accounts.receiver_token_account.key()
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimFee<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, seeds = [b"claimable_fee", mint.key().as_ref()], bump)]
    pub claimable_fee: Account<'info, ClaimableFee>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = state,
        token::token_program = token_program,
        seeds = [b"treasury_token_account", mint.key().as_ref()],
        bump
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = signer,
        token::token_program = token_program,
    )]
    pub receiver_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
