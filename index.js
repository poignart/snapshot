import ethers from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function uniq(a) {
    var seen = {};
    return a.filter(function (item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
}

const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

if (!ALCHEMY_KEY) {
    throw new Error("ALCHEMY_KEY required");
}

const rpc = `wss://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`;
const provider = new ethers.providers.WebSocketProvider(rpc);

const addresses = [
    "0x165CD37b4C644C2921454429E7F9358d18A45e14", // Official Ukraine
    "0x10E1439455BD2624878b243819E31CfEE9eb721C", // Unchain
    "0x633b7218644b83D57d90e7299039ebAb19698e9C", // Ukraine DAO
];
const outputFile = "whitelist.txt";

const params = {
    fromBlock: "0xd8b038", // feb 24 2022 00:00 UTC
    toBlock: "latest",
    maxCount: "0x3e8",
    excludeZeroValue: true,
    category: ["external", "internal", "erc20", "erc721", "erc1155"],
};

const getTransfersByPage = async (address, page) => {
    const { transfers: result, pageKey } = await provider.send(
        "alchemy_getAssetTransfers",
        [{ ...params, toAddress: address, pageKey: page }]
    );
    const addresses = result
        ? result
              .map((item) => item.from)
              .filter((a) => a !== "0x0000000000000000000000000000000000000000")
        : [];
    const final = uniq(addresses);
    final.forEach((a) => {
        fs.appendFileSync(outputFile, `${a}\n`);
    });
    return { total: final.length, pageKey };
};

const getAllTransfers = async (address) => {
    console.log(`fetching data for ${address}`);

    let finalTotal = 0;
    let { total, pageKey } = await getTransfersByPage(address);
    let page = 1;
    finalTotal += total;
    console.log(`found ${total} in page ${page}`);
    while (!!pageKey) {
        await sleep(50);
        ({ total, pageKey } = await getTransfersByPage(address, pageKey));
        page++;
        finalTotal += total;
        console.log(`found ${total} in page ${page}`);
    }
    console.log(`totally found ${finalTotal} addresses\n\n`);
};

const main = async () => {
    console.log(`cleaning outfile file: ${outputFile}`);
    fs.writeFileSync(outputFile, "");

    const [{ timestamp: fromTime }, { timestamp: toTime }] = await Promise.all([
        provider.getBlock(params.fromBlock),
        provider.getBlock(params.toBlock),
    ]);
    const fromDate = new Date(fromTime * 1000);
    const toDate = new Date(toTime * 1000);
    console.log(
        `fetching data between ${fromDate.toUTCString()} and ${toDate.toUTCString()}`
    );

    let index = 0;
    while (index < addresses.length) {
        await getAllTransfers(addresses[index]);
        index += 1;
    }
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
