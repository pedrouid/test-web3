import * as React from "react";
import styled from "styled-components";
import Web3 from "web3";
import { convertUtf8ToHex } from "@walletconnect/utils";
import Button from "./components/Button";
import Column from "./components/Column";
import Wrapper from "./components/Wrapper";
import Modal from "./components/Modal";
import Header from "./components/Header";
import Loader from "./components/Loader";
import AccountAssets from "./components/AccountAssets";
import { apiGetAccountAssets } from "./helpers/api";
import {
  hashPersonalMessage,
  recoverPublicKey,
  recoverPersonalSignature,
  formatTestTransaction
} from "./helpers/utilities";
import { IAssetData } from "./helpers/types";
// @ts-ignore
import WalletConnectWeb3Provider from "@walletconnect/web3-provider";
import { fonts } from "./styles";
import { openBox, getProfile } from "./helpers/box";
import { FUNCTION_BALANCE_OF, FUNCTION_TRANSFER } from "./constants";
import { callBalanceOf, callTransfer } from "./helpers/web3";

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
`;

const SContent = styled(Wrapper)`
  width: 100%;
  height: 100%;
  padding: 0 16px;
`;

const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  word-break: break-word;
`;

const SLanding = styled(Column)`
  height: 600px;
`;

const SModalContainer = styled.div`
  width: 100%;
  position: relative;
  word-wrap: break-word;
`;

const SModalTitle = styled.div`
  margin: 1em 0;
  font-size: 20px;
  font-weight: 700;
`;

const SModalParagraph = styled.p`
  margin-top: 30px;
`;

const SBalances = styled(SLanding)`
  height: 100%;
  & h3 {
    padding-top: 30px;
  }
`;

const STable = styled(SContainer)`
  flex-direction: column;
  text-align: left;
`;

const SRow = styled.div`
  width: 100%;
  display: flex;
  margin: 6px 0;
`;

const SKey = styled.div`
  width: 30%;
  font-weight: 700;
`;

const SValue = styled.div`
  width: 70%;
  font-family: monospace;
`;

const STestButtonContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
`;

const STestButton = styled(Button)`
  border-radius: 8px;
  font-size: ${fonts.size.medium};
  height: 44px;
  width: 100%;
  max-width: 175px;
  margin: 12px;
`;

interface IAppState {
  fetching: boolean;
  address: string;
  web3: any;
  provider: any;
  connected: boolean;
  chainId: number;
  networkId: number;
  assets: IAssetData[];
  showModal: boolean;
  pendingRequest: boolean;
  activeProvider: string;
  result: any | null;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: "",
  web3: null,
  provider: null,
  connected: false,
  chainId: 1,
  networkId: 1,
  assets: [],
  showModal: false,
  pendingRequest: false,
  activeProvider: "web3-provider",
  result: null
};

const PROVIDERS = {
  WEB3: "web3-provider",
  ETH: "eth-provider"
};

class App extends React.Component<any, any> {
  public state: IAppState = {
    ...INITIAL_STATE
  };

  public getWalletConnectProvider = () => {
    let WalletConnectProvider = null;
    switch (this.state.activeProvider) {
      case PROVIDERS.WEB3:
        WalletConnectProvider = WalletConnectWeb3Provider as any;
        break;
      default:
        break;
    }
    if (!WalletConnectProvider) {
      throw new Error("Failed to get WalletConnectProvider library");
    }
    return WalletConnectProvider;
  };

  public onConnect = async () => {
    const WalletConnectProvider = this.getWalletConnectProvider();

    // const opts = { infuraId: process.env.REACT_APP_INFURA_ID };

    const opts = {
      rpc: {
        1: "https://ethereum-api.xyz/rpc?chainId=1",
        3: "https://ethereum-api.xyz/rpc?chainId=3",
        4: "https://ethereum-api.xyz/rpc?chainId=4",
        5: "https://ethereum-api.xyz/rpc?chainId=5",
        42: "https://ethereum-api.xyz/rpc?chainId=42"
      }
    };

    // const opts = { disableRpc: true }

    console.log("[onConnect]", "opts", opts); // tslint:disable-line

    const provider = new WalletConnectProvider(opts);

    console.log("[onConnect]", "provider", provider); // tslint:disable-line

    await provider.enable();

    provider.on("accountsChanged", (accounts: string[]) => {
      this.setState({ address: accounts[0] });
      this.getAccountAssets();
    });
    provider.on("chainChanged", (chainId: number) => {
      this.setState({ chainId });
      this.getAccountAssets();
    });
    provider.on("networkChanged", (networkId: number) => {
      this.setState({ networkId });
      this.getAccountAssets();
    });

    const web3: any = new Web3(provider);

    const accounts = await web3.eth.getAccounts();
    console.log("[onConnect] accounts", accounts); // tslint:disable-line

    const address = accounts[0];
    console.log("[onConnect] address", address); // tslint:disable-line

    const networkId = await web3.eth.net.getId();
    console.log("[onConnect] networkId", networkId); // tslint:disable-line

    web3.eth.extend({
      methods: [
        {
          name: "chainId",
          call: "eth_chainId",
          outputFormatter: web3.utils.hexToNumber
        }
      ]
    });

    const chainId = await web3.eth.chainId();
    console.log("[onConnect] chainId", chainId); // tslint:disable-line

    window.web3Test = web3;

    await this.setState({
      web3,
      provider,
      connected: true,
      address,
      chainId,
      networkId
    });
    await this.getAccountAssets();
  };

  public getAccountAssets = async () => {
    const { address, chainId } = this.state;
    this.setState({ fetching: true });
    try {
      // get account balances
      const assets = await apiGetAccountAssets(address, chainId);

      await this.setState({ fetching: false, assets });
    } catch (error) {
      console.error(error); // tslint:disable-line
      await this.setState({ fetching: false });
    }
  };

  public toggleModal = () =>
    this.setState({ showModal: !this.state.showModal });

  public testOpenBox = async () => {
    function getBoxProfile(address: string, provider: any) {
      return new Promise(async (resolve, reject) => {
        try {
          await openBox(address, provider, async () => {
            const profile = await getProfile(address);
            resolve(profile);
          });
        } catch (error) {
          reject(error);
        }
      });
    }

    const { address, provider } = this.state;

    try {
      // open modal
      this.toggleModal();

      // toggle pending request indicator
      this.setState({ pendingRequest: true });

      // send transaction
      const result = await getBoxProfile(address, provider);

      // format displayed result
      const formattedResult = {
        method: "box_open",
        result
      };

      // display result
      this.setState({
        pendingRequest: false,
        result: formattedResult || null
      });
    } catch (error) {
      console.error(error); // tslint:disable-line
      this.setState({ pendingRequest: false, result: null });
    }
  };

  public testContractCall = async (functionSig: string) => {
    let contractCall = null;
    switch (functionSig) {
      case FUNCTION_BALANCE_OF:
        contractCall = callBalanceOf;
        break;
      case FUNCTION_TRANSFER:
        contractCall = callTransfer;
        break;

      default:
        break;
    }

    if (!contractCall) {
      throw new Error(
        `No matching contract calls for functionSig=${functionSig}`
      );
    }

    const { web3, address, chainId } = this.state;
    try {
      // open modal
      this.toggleModal();

      // toggle pending request indicator
      this.setState({ pendingRequest: true });

      // send transaction
      const result = await contractCall(address, chainId, web3);

      // format displayed result
      const formattedResult = {
        method: functionSig,
        result
      };

      // display result
      this.setState({
        web3,
        pendingRequest: false,
        result: formattedResult || null
      });
    } catch (error) {
      console.error(error); // tslint:disable-line
      this.setState({ web3, pendingRequest: false, result: null });
    }
  };

  public testSendTransaction = async () => {
    const { web3, address, chainId } = this.state;

    if (!web3) {
      return;
    }

    const tx = await formatTestTransaction(address, chainId);
    console.log("[testSendTransaction] tx", tx); // tslint:disable-line
    try {
      // open modal
      this.toggleModal();

      // toggle pending request indicator
      this.setState({ pendingRequest: true });

      // @ts-ignore
      function sendTransaction(_tx: any) {
        return new Promise((resolve, reject) => {
          web3.eth
            .sendTransaction(_tx)
            .once("transactionHash", (txHash: string) => resolve(txHash))
            .catch((err: any) => reject(err));
        });
      }

      // send transaction
      const result = await sendTransaction(tx);

      // format displayed result
      const formattedResult = {
        method: "eth_sendTransaction",
        txHash: result,
        from: address,
        to: address,
        value: "0 ETH"
      };

      // display result
      this.setState({
        web3,
        pendingRequest: false,
        result: formattedResult || null
      });
    } catch (error) {
      console.error(error); // tslint:disable-line
      this.setState({ web3, pendingRequest: false, result: null });
    }
  };

  public testSignMessage = async () => {
    const { web3, address } = this.state;

    if (!web3) {
      return;
    }

    // test message
    const message = "My email is john@doe.com - 1537836206101";

    // hash message
    const hash = hashPersonalMessage(message);

    try {
      // open modal
      this.toggleModal();

      // toggle pending request indicator
      this.setState({ pendingRequest: true });

      // send message
      const result = await web3.eth.sign(hash, address);

      // verify signature
      const signer = recoverPublicKey(result, hash);
      const verified = signer.toLowerCase() === address.toLowerCase();

      // format displayed result
      const formattedResult = {
        method: "eth_sign",
        address,
        signer,
        verified,
        result
      };

      // display result
      this.setState({
        web3,
        pendingRequest: false,
        result: formattedResult || null
      });
    } catch (error) {
      console.error(error); // tslint:disable-line
      this.setState({ web3, pendingRequest: false, result: null });
    }
  };

  public testSignPersonalMessage = async () => {
    const { web3, address } = this.state;

    if (!web3) {
      return;
    }

    // test message
    const message = "My email is john@doe.com - 1537836206101";

    // encode message (hex)
    const hexMsg = convertUtf8ToHex(message);

    try {
      // open modal
      this.toggleModal();

      // toggle pending request indicator
      this.setState({ pendingRequest: true });

      // send message
      const result = await web3.eth.personal.sign(hexMsg, address);

      // verify signature
      const signer = recoverPersonalSignature(result, message);
      const verified = signer.toLowerCase() === address.toLowerCase();

      // format displayed result
      const formattedResult = {
        method: "personal_sign",
        address,
        signer,
        verified,
        result
      };

      // display result
      this.setState({
        web3,
        pendingRequest: false,
        result: formattedResult || null
      });
    } catch (error) {
      console.error(error); // tslint:disable-line
      this.setState({ web3, pendingRequest: false, result: null });
    }
  };

  public resetApp = async () => {
    const { web3 } = this.state;
    if (web3 && web3.currentProvider) {
      await web3.currentProvider.close();
    }
    this.setState({ ...INITIAL_STATE });
  };

  public render = () => {
    const {
      assets,
      address,
      connected,
      chainId,
      fetching,
      showModal,
      pendingRequest,
      result
    } = this.state;

    return (
      <SLayout>
        <Column maxWidth={1000} spanHeight>
          <Header
            connected={connected}
            address={address}
            chainId={chainId}
            killSession={this.resetApp}
          />
          <SContent>
            {fetching ? (
              <Column center>
                <SContainer>
                  <Loader />
                </SContainer>
              </Column>
            ) : !!assets && !!assets.length ? (
              <SBalances>
                <h3>Actions</h3>
                <Column center>
                  <STestButtonContainer>
                    <STestButton left onClick={this.testSendTransaction}>
                      {"eth_sendTransaction"}
                    </STestButton>

                    <STestButton left onClick={this.testSignMessage}>
                      {"eth_sign"}
                    </STestButton>

                    <STestButton left onClick={this.testSignPersonalMessage}>
                      {"personal_sign"}
                    </STestButton>

                    <STestButton
                      left
                      onClick={() => this.testContractCall(FUNCTION_BALANCE_OF)}
                    >
                      {FUNCTION_BALANCE_OF}
                    </STestButton>

                    <STestButton
                      left
                      onClick={() => this.testContractCall(FUNCTION_TRANSFER)}
                    >
                      {FUNCTION_TRANSFER}
                    </STestButton>

                    <STestButton left onClick={this.testOpenBox}>
                      {"box_open"}
                    </STestButton>
                  </STestButtonContainer>
                </Column>
                <h3>Balances</h3>
                <AccountAssets chainId={chainId} assets={assets} />{" "}
              </SBalances>
            ) : (
              <SLanding center>
                <Column center>
                  <STestButtonContainer>
                    {Object.keys(PROVIDERS).map(key => {
                      const providerOption = PROVIDERS[key];
                      return (
                        <STestButton
                          key={providerOption}
                          outline={this.state.activeProvider === providerOption}
                          onClick={() =>
                            this.setState({ activeProvider: providerOption })
                          }
                        >
                          {providerOption}
                        </STestButton>
                      );
                    })}
                  </STestButtonContainer>
                </Column>
                <h3>{`Test Web3`}</h3>
                <Button onClick={this.onConnect}>{`Connect`}</Button>
              </SLanding>
            )}
          </SContent>
        </Column>
        <Modal show={showModal} toggleModal={this.toggleModal}>
          {pendingRequest ? (
            <SModalContainer>
              <SModalTitle>{"Pending Call Request"}</SModalTitle>
              <SContainer>
                <Loader />
                <SModalParagraph>
                  {"Approve or reject request using your wallet"}
                </SModalParagraph>
              </SContainer>
            </SModalContainer>
          ) : result ? (
            <SModalContainer>
              <SModalTitle>{"Call Request Approved"}</SModalTitle>
              <STable>
                {Object.keys(result).map(key => (
                  <SRow key={key}>
                    <SKey>{key}</SKey>
                    <SValue>{result[key].toString()}</SValue>
                  </SRow>
                ))}
              </STable>
            </SModalContainer>
          ) : (
            <SModalContainer>
              <SModalTitle>{"Call Request Rejected"}</SModalTitle>
            </SModalContainer>
          )}
        </Modal>
      </SLayout>
    );
  };
}

export default App;
