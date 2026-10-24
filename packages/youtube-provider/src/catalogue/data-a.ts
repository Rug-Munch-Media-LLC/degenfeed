/**
 * Curated catalogue — part A: news, media brands, market analysis.
 *
 * Format: handle|name|category|subcategory|weight|subsK|provenance-source
 * The handle is provisional: the first ingest run resolves it to a `UC…` channel_id
 * (stable key). `subsK` is an approximate subscriber count (thousands) at selection.
 * rank = row position, global across part A then part B.
 */
export const ROWS_A = `
@coinbureau|Coin Bureau|market_analysis|daily-news|1.0|2400|socialblade-crypto
@altcoindaily|Altcoin Daily|market_analysis|daily-news|1.0|1400|socialblade-crypto
@bankless|Bankless|market_analysis|market-commentary|1.0|220|socialblade-crypto
@thedefiant|The Defiant|defi|protocol-deep-dives|0.9|120|socialblade-crypto
@finematics|Finematics|defi|protocol-deep-dives|0.9|350|socialblade-crypto
@a16zcrypto|a16z crypto|defi|protocol-deep-dives|0.9|90|curated-manual
@coindesk|CoinDesk|market_analysis|daily-news|0.9|500|socialblade-crypto
@cointelegraph|Cointelegraph|market_analysis|daily-news|0.9|450|socialblade-crypto
@decryptmedia|Decrypt|market_analysis|daily-news|0.8|80|socialblade-crypto
@theblockcrypto|The Block|market_analysis|daily-news|0.8|60|curated-manual
@blockworks|Blockworks Macro|market_analysis|market-commentary|0.9|90|curated-manual
@dlnews|DL News|market_analysis|daily-news|0.7|20|curated-manual
@unchainedcrypto|Unchained|market_analysis|interviews|0.9|100|socialblade-crypto
@epicenterpodcast|Epicenter|defi|protocol-deep-dives|0.8|40|curated-manual
@zeroknowledgepodcast|Zero Knowledge|security_tech|infrastructure|0.8|25|curated-manual
@thechoppingblock|The Chopping Block|market_analysis|market-commentary|0.8|45|curated-manual
@bellcurvepod|Bell Curve|defi|protocol-deep-dives|0.8|30|curated-manual
@empirepod|Empire|market_analysis|market-commentary|0.8|55|curated-manual
@lightspeedpod|Lightspeed|defi|layer2-scaling|0.7|25|curated-manual
@0xresearch|0xResearch|market_analysis|crypto-research|0.7|20|curated-manual
@forwardguidance|Forward Guidance|market_analysis|macro-economics|0.8|80|curated-manual
@onthebrinkpod|On the Brink|security_tech|cybersecurity|0.7|30|curated-manual
@thinkingcrypto|Thinking Crypto|market_analysis|interviews|0.8|180|socialblade-crypto
@cryptobanter|Crypto Banter|market_analysis|market-commentary|0.8|1100|socialblade-crypto
@paulbarronnetwork|Paul Barron Network|market_analysis|market-commentary|0.7|200|socialblade-crypto
@thecryptolark|The Crypto Lark|market_analysis|altcoin-research|0.7|150|socialblade-crypto
@datadash|DataDash|market_analysis|market-commentary|0.6|300|socialblade-crypto
@boxmining|Boxmining|market_analysis|altcoin-research|0.6|150|socialblade-crypto
@chicocrypto|Chico Crypto|market_analysis|altcoin-research|0.6|300|socialblade-crypto
@themoonyt|The Moon|market_analysis|altcoin-research|0.6|700|socialblade-crypto
@cryptozombie|Crypto Zombie|market_analysis|daily-news|0.5|200|socialblade-crypto
@discovercrypto|Discover Crypto|market_analysis|daily-news|0.6|900|socialblade-crypto
@cryptonites|Cryptonites|market_analysis|market-commentary|0.5|60|curated-manual
@cryptokirby|Crypto Kirby|market_analysis|altcoin-research|0.5|80|curated-manual
@nuggetsnews|Nugget's News|market_analysis|daily-news|0.5|120|socialblade-crypto
@sunnysdecree|Sunny Decree|market_analysis|market-commentary|0.5|150|socialblade-crypto
@ivanontech|Ivan on Tech|defi|blockchain-dev|0.7|300|socialblade-crypto
@moralisweb3|Moralis Web3|defi|web3-dev|0.6|60|curated-manual
@whiteboardcrypto|Whiteboard Crypto|defi|beginner-friendly|0.7|500|socialblade-crypto
@99bitcoins|99Bitcoins|defi|beginner-friendly|0.6|200|socialblade-crypto
@bitcoinmagazine|Bitcoin Magazine|macro_bitcoin|bitcoin-maximalism|0.9|400|socialblade-crypto
@whatbitcoindid|What Bitcoin Did|macro_bitcoin|bitcoin-philosophy|0.8|120|curated-manual
@thebitcoinstandard|The Bitcoin Standard|macro_bitcoin|bitcoin-education|0.7|60|curated-manual
@bitcoinmagazinepro|Bitcoin Magazine Pro|macro_bitcoin|bitcoin-education|0.5|30|curated-manual
@rippleffect|Ripple Effect|market_analysis|altcoin-research|0.4|20|socialblade-crypto
@xrpcommunity|XRP Community|market_analysis|altcoin-research|0.4|20|curated-manual
@ethereumnetwork|Ethereum Foundation|defi|layer2-scaling|0.9|60|curated-manual
@ethereumcathera|Ethereum Cat Herders|defi|protocol-deep-dives|0.7|20|curated-manual
@solanalabs|Solana|defi|infrastructure|0.8|40|curated-manual
@solanaed|Solana Floor|market_analysis|altcoin-research|0.5|40|curated-manual
@suinetwork|Sui Network|defi|infrastructure|0.6|25|curated-manual
@aptoslabs|Aptos|defi|infrastructure|0.6|20|curated-manual
@nearprotocol|NEAR Protocol|defi|infrastructure|0.6|25|curated-manual
@avalancheavax|Avalanche|defi|infrastructure|0.6|30|curated-manual
@polkadotnetwork|Polkadot|defi|infrastructure|0.6|40|curated-manual
@cardano|Cardano|defi|infrastructure|0.6|20|curated-manual
@chainlink|Chainlink|defi|infrastructure|0.8|60|curated-manual
@aave|Aave|defi|protocol-deep-dives|0.8|30|curated-manual
@uniswap|Uniswap|defi|protocol-deep-dives|0.8|40|curated-manual
@makerdao|MakerDAO|defi|protocol-deep-dives|0.7|20|curated-manual
@compoundlabs|Compound Labs|defi|protocol-deep-dives|0.7|15|curated-manual
@curvefinance|Curve Finance|defi|defi-math|0.7|15|curated-manual
@lido|Lido|defi|yield-farming|0.7|15|curated-manual
@eigenlayer|EigenLayer|defi|yield-farming|0.7|20|curated-manual
@arbitrum|Arbitrum|defi|layer2-scaling|0.8|25|curated-manual
@optimism|Optimism|defi|layer2-scaling|0.8|25|curated-manual
@base|Base|defi|layer2-scaling|0.8|20|curated-manual
@zkSync|zkSync|defi|layer2-scaling|0.7|30|curated-manual
@starknet|Starknet|defi|layer2-scaling|0.7|20|curated-manual
@polygontechnology|Polygon|defi|layer2-scaling|0.7|40|curated-manual
@coinbase|Coinbase|market_analysis|daily-news|0.9|80|curated-manual
@binance|Binance|market_analysis|daily-news|0.9|300|curated-manual
@kraken|Kraken|market_analysis|daily-news|0.7|60|curated-manual
@okxofficial|OKX|market_analysis|daily-news|0.7|40|curated-manual
@bybit|Bybit|market_analysis|daily-news|0.6|40|curated-manual
@ledger|Ledger|security_tech|cybersecurity|0.8|150|curated-manual
@trezor|Trezor|security_tech|cybersecurity|0.7|50|curated-manual
@certik|CertiK|security_tech|smart-contract-audits|0.8|50|curated-manual
@peckshield|PeckShield|security_tech|defi-hacks|0.7|15|curated-manual
@slowmist|SlowMist|security_tech|defi-hacks|0.7|15|curated-manual
@trailofbits|Trail of Bits|security_tech|smart-contract-audits|0.8|20|curated-manual
@openzeppelin|OpenZeppelin|security_tech|smart-contracts|0.8|25|curated-manual
@immunefi|Immunefi|security_tech|defi-hacks|0.7|15|curated-manual
@blocksec|BlockSec|security_tech|defi-hacks|0.6|10|curated-manual
@thehackernews|The Hacker News|security_tech|cybersecurity|0.6|700|socialblade-crypto
@defiprime|DeFi Prime|defi|protocol-deep-dives|0.6|20|curated-manual
@defipulse|DeFi Pulse|defi|defi-analysis|0.6|30|curated-manual
@tokenterminal|Token Terminal|defi|defi-analysis|0.7|20|curated-manual
@messari|Messari|market_analysis|crypto-research|0.8|40|curated-manual
@glassnode|Glassnode|market_analysis|market-sentiment|0.7|20|curated-manual
@santiment|Santiment|market_analysis|market-sentiment|0.7|15|curated-manual
@intotheblock|IntoTheBlock|market_analysis|market-sentiment|0.6|15|curated-manual
@nansen|Nansen|market_analysis|crypto-research|0.8|25|curated-manual
@arkham|Arkham|market_analysis|crypto-research|0.7|20|curated-manual
@dune|Dune|market_analysis|crypto-research|0.7|15|curated-manual
@defillama|DefiLlama|defi|defi-analysis|0.8|25|curated-manual
@coingecko|CoinGecko|market_analysis|daily-news|0.7|30|curated-manual
@coinmarketcap|CoinMarketCap|market_analysis|daily-news|0.7|40|curated-manual
@tradingview|TradingView|trading|technical-analysis|0.9|200|curated-manual
@investingcom|Investing.com|market_analysis|daily-news|0.6|100|curated-manual
@blockchainreporter|Blockchain Reporter|market_analysis|daily-news|0.4|20|socialblade-crypto
@ambcrypto|AMBCrypto|market_analysis|daily-news|0.4|30|socialblade-crypto
@beincrypto|BeInCrypto|market_analysis|daily-news|0.5|60|socialblade-crypto
@cryptoslate|CryptoSlate|market_analysis|daily-news|0.5|30|socialblade-crypto
@cryptopotato|CryptoPotato|market_analysis|daily-news|0.5|30|socialblade-crypto
@newsbtc|NewsBTC|market_analysis|daily-news|0.4|20|socialblade-crypto
@bitcoincom|Bitcoin.com|market_analysis|daily-news|0.6|200|socialblade-crypto
@cryptonews|CryptoNews|market_analysis|daily-news|0.5|60|socialblade-crypto
@thedefiantio|The Defiant Podcast|defi|interviews|0.7|20|curated-manual
@uncommoncore|Uncommon Core|market_analysis|crypto-research|0.7|20|curated-manual
@delphidigital|Delphi Digital|market_analysis|crypto-research|0.8|30|curated-manual
@galaxyhq|Galaxy|market_analysis|crypto-research|0.7|25|curated-manual
@parafi|ParaFi Capital|market_analysis|crypto-research|0.6|10|curated-manual
@variantfund|Variant Fund|market_analysis|crypto-research|0.6|10|curated-manual
@placeholder|Placeholder|market_analysis|crypto-research|0.6|10|curated-manual
@framesxyz|Frames|market_analysis|crypto-research|0.5|10|curated-manual
@lukeleary|Luke Leary|market_analysis|market-commentary|0.4|20|curated-manual
@cryptowendyo|Crypto Wendy O|market_analysis|altcoin-research|0.5|200|socialblade-crypto
@girlgonedcrypto|Girl Gone Crypto|market_analysis|altcoin-research|0.5|150|socialblade-crypto
@cryptobirb|Crypto Birb|market_analysis|altcoin-research|0.4|100|socialblade-crypto
@thecryptocactus|The Crypto Cactus|market_analysis|altcoin-research|0.4|50|curated-manual
@cryptojack|Crypto Jack|market_analysis|altcoin-research|0.4|40|curated-manual
@krowncrypto|Krown's Crypto Cave|market_analysis|altcoin-research|0.4|60|curated-manual
@cryptorus|CryptoRUs|market_analysis|market-commentary|0.4|80|curated-manual
@bitboycrypto|BitBoy Crypto|market_analysis|altcoin-research|0.4|1400|socialblade-crypto
@jebb|Jebb|market_analysis|altcoin-research|0.4|80|curated-manual
@brandonhong|Brandon Hong|market_analysis|altcoin-research|0.3|30|curated-manual
@cryptotips|Crypto Tips|market_analysis|altcoin-research|0.3|30|curated-manual
@cypherpunk|Cypherpunk|market_analysis|altcoin-research|0.3|20|curated-manual
@blockchainbob|Blockchain Bob|market_analysis|altcoin-research|0.3|20|curated-manual
@coincodex|CoinCodex|market_analysis|daily-news|0.4|20|curated-manual
@changelly|Changelly|market_analysis|daily-news|0.4|20|curated-manual
`;
